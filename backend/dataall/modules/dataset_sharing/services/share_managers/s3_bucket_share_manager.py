import abc
import json
import logging
from itertools import count

from dataall.base.aws.iam import IAM
from dataall.base.aws.sts import SessionHelper
from dataall.core.environment.db.environment_models import Environment, EnvironmentGroup
from dataall.modules.dataset_sharing.aws.kms_client import KmsClient
from dataall.modules.dataset_sharing.aws.s3_client import S3ControlClient, S3Client
from dataall.modules.dataset_sharing.db.share_object_models import ShareObject
from dataall.modules.dataset_sharing.services.share_managers.share_manager_utils import ShareManagerUtils
from dataall.modules.dataset_sharing.services.dataset_alarm_service import DatasetAlarmService
from dataall.modules.datasets_base.db.dataset_models import Dataset, DatasetBucket
from dataall.modules.dataset_sharing.db.share_object_repositories import ShareObjectRepository

logger = logging.getLogger(__name__)

DATAALL_READ_ONLY_SID = "DataAll-Bucket-ReadOnly"
DATAALL_ALLOW_OWNER_SID = "AllowAllToAdmin"
IAM_S3BUCKET_ROLE_POLICY = "dataall-targetDatasetS3Bucket-AccessControlPolicy"


class S3BucketShareManager:
    def __init__(
            self,
            session,
            dataset: Dataset,
            share: ShareObject,
            target_bucket: DatasetBucket,
            source_environment: Environment,
            target_environment: Environment,
            source_env_group: EnvironmentGroup,
            env_group: EnvironmentGroup,
    ):
        self.session = session
        self.source_env_group = source_env_group
        self.env_group = env_group
        self.dataset = dataset
        self.share = share
        self.target_bucket = target_bucket
        self.source_environment = source_environment
        self.target_environment = target_environment
        self.share_item = ShareObjectRepository.find_sharable_item(
            session,
            share.shareUri,
            target_bucket.bucketUri,
        )
        self.source_account_id = target_bucket.AwsAccountId
        self.target_account_id = target_environment.AwsAccountId
        self.source_env_admin = source_env_group.environmentIAMRoleArn
        self.target_requester_IAMRoleName = share.principalIAMRoleName
        self.bucket_name = target_bucket.S3BucketName
        self.dataset_admin = dataset.IAMDatasetAdminRoleArn
        self.bucket_region = target_bucket.region

    @abc.abstractmethod
    def process_approved_shares(self, *kwargs) -> bool:
        raise NotImplementedError

    @abc.abstractmethod
    def process_revoked_shares(self, *kwargs) -> bool:
        raise NotImplementedError

    def grant_s3_iam_access(self):
        """
        Updates requester IAM role policy to include requested S3 bucket and kms key
        :return:
        """
        logger.info(
            f'Grant target role {self.target_requester_IAMRoleName} access policy'
        )
        existing_policy = IAM.get_role_policy(
            self.target_account_id,
            self.target_requester_IAMRoleName,
            IAM_S3BUCKET_ROLE_POLICY,
        )
        key_alias = f"alias/{self.target_bucket.KmsAlias}"
        kms_client = KmsClient(self.source_account_id, self.source_environment.region)
        kms_key_id = kms_client.get_key_id(key_alias)

        if existing_policy:  # type dict
            s3_target_resources = [
                f"arn:aws:s3:::{self.bucket_name}",
                f"arn:aws:s3:::{self.bucket_name}/*"
            ]

            share_manager = ShareManagerUtils(
                self.session,
                self.dataset,
                self.share,
                self.source_environment,
                self.target_environment,
                self.source_env_group,
                self.env_group
            )
            share_manager.add_missing_resources_to_policy_statement(
                resource_type=self.bucket_name,
                target_resources=s3_target_resources,
                existing_policy_statement=existing_policy["Statement"][0],
                iam_role_policy_name=IAM_S3BUCKET_ROLE_POLICY
            )

            if kms_key_id:
                kms_target_resources = [
                    f"arn:aws:kms:{self.bucket_region}:{self.source_account_id}:key/{kms_key_id}"
                ]
                if len(existing_policy["Statement"]) > 1:
                    share_manager.add_missing_resources_to_policy_statement(
                        resource_type=kms_key_id,
                        target_resources=kms_target_resources,
                        existing_policy_statement=existing_policy["Statement"][1],
                        iam_role_policy_name=IAM_S3BUCKET_ROLE_POLICY
                    )
                else:
                    additional_policy = {
                        "Effect": "Allow",
                        "Action": [
                            "kms:*"
                        ],
                        "Resource": kms_target_resources
                    }
                    existing_policy["Statement"].append(additional_policy)

            policy = existing_policy
        else:
            logger.info(
                f'{IAM_S3BUCKET_ROLE_POLICY} does not exists for IAM role {self.target_requester_IAMRoleName}, creating...'
            )
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "s3:*"
                        ],
                        "Resource": [
                            f"arn:aws:s3:::{self.bucket_name}",
                            f"arn:aws:s3:::{self.bucket_name}/*"
                        ]
                    }
                ]
            }
            if kms_key_id:
                additional_policy = {
                    "Effect": "Allow",
                    "Action": [
                        "kms:*"
                    ],
                    "Resource": [
                        f"arn:aws:kms:{self.bucket_region}:{self.source_account_id}:key/{kms_key_id}"
                    ]
                }
                policy["Statement"].append(additional_policy)

        IAM.update_role_policy(
            self.target_account_id,
            self.target_requester_IAMRoleName,
            IAM_S3BUCKET_ROLE_POLICY,
            json.dumps(policy),
        )

    def get_bucket_policy_or_default(self):
        """
        Fetches the existing bucket policy for the S3 bucket if one exists otherwise returns the default bucket policy
        :return:
        """
        s3_client = S3Client(self.source_account_id, self.source_environment.region)
        bucket_policy = s3_client.get_bucket_policy(self.bucket_name)
        if bucket_policy:
            logger.info(
                f'There is already an existing policy for bucket {self.bucket_name}, will be updating policy...'
            )
            bucket_policy = json.loads(bucket_policy)
        else:
            logger.info(
                f'Bucket policy for {self.bucket_name} does not exist, generating default policy...'
            )
            exceptions_roleId = self.get_bucket_owner_roleid()
            bucket_policy = S3ControlClient.generate_default_bucket_policy(
                self.bucket_name,
                exceptions_roleId,
                DATAALL_ALLOW_OWNER_SID
            )
        return bucket_policy

    def get_bucket_owner_roleid(self):
        exceptions_roleId = [f'{item}:*' for item in SessionHelper.get_role_ids(
            self.source_account_id,
            [self.dataset_admin, self.source_env_admin, SessionHelper.get_delegation_role_arn(self.source_account_id)]
        )]
        return exceptions_roleId

    def grant_role_bucket_policy(self):
        """
        This function will update bucket policy by granting admin access to dataset admin, pivot role
        and environment admin along with read only access to accepted share roles. All the policies will only be added
        once.
        :return:
        """
        logger.info(
            f'Granting access via Bucket policy for {self.bucket_name}'
        )
        try:
            target_requester_arn = self.get_role_arn(self.target_account_id, self.target_requester_IAMRoleName)
            bucket_policy = self.get_bucket_policy_or_default()
            counter = count()
            statements = {item.get("Sid", next(counter)): item for item in bucket_policy.get("Statement", {})}
            if DATAALL_READ_ONLY_SID in statements.keys():
                logger.info(f'Bucket policy contains share statement {DATAALL_READ_ONLY_SID}, updating the current one')
                statements[DATAALL_READ_ONLY_SID] = self.add_target_arn_to_statement_principal(statements[DATAALL_READ_ONLY_SID], target_requester_arn)
            else:
                logger.info(f'Bucket policy does not contain share statement {DATAALL_READ_ONLY_SID}, generating a new one')
                statements[DATAALL_READ_ONLY_SID] = self.generate_default_bucket_read_policy_statement(self.bucket_name, target_requester_arn)

            if DATAALL_ALLOW_OWNER_SID not in statements.keys():
                statements[DATAALL_ALLOW_OWNER_SID] = self.generate_owner_access_statement(self.bucket_name, self.get_bucket_owner_roleid())

            bucket_policy["Statement"] = list(statements.values())
            s3_client = S3Client(self.source_account_id, self.source_environment.region)
            s3_client.create_bucket_policy(self.bucket_name, json.dumps(bucket_policy))
        except Exception as e:
            logger.exception(
                f'Failed during bucket policy management {e}'
            )
            raise e

    def add_target_arn_to_statement_principal(self, statement, target_requester_arn):
        principal_list = self.get_principal_list(statement)
        if f"{target_requester_arn}" not in principal_list:
            principal_list.append(f"{target_requester_arn}")
        statement["Principal"]["AWS"] = principal_list
        return statement

    @staticmethod
    def generate_owner_access_statement(s3_bucket_name, owner_roleId):
        owner_policy_statement = {
            "Sid": DATAALL_ALLOW_OWNER_SID,
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": [
                f"arn:aws:s3:::{s3_bucket_name}",
                f"arn:aws:s3:::{s3_bucket_name}/*"
            ],
            "Condition": {
                "StringLike": {
                    "aws:userId": owner_roleId
                }
            }
        }
        return owner_policy_statement

    @staticmethod
    def get_principal_list(statement):
        principal_list = statement["Principal"]["AWS"]
        if isinstance(principal_list, str):
            principal_list = [principal_list]
        return principal_list

    def grant_dataset_bucket_key_policy(self):
        if (self.target_bucket.imported and self.target_bucket.importedKmsKey) or not self.target_bucket.imported:
            logger.info(
                'Updating dataset Bucket KMS key policy...'
            )
            key_alias = f"alias/{self.target_bucket.KmsAlias}"
            kms_client = KmsClient(self.source_account_id, self.source_environment.region)
            kms_key_id = kms_client.get_key_id(key_alias)
            existing_policy = kms_client.get_key_policy(kms_key_id)
            target_requester_id = SessionHelper.get_role_id(self.target_account_id, self.target_requester_IAMRoleName)
            if existing_policy and f'{target_requester_id}:*' not in existing_policy:
                policy = json.loads(existing_policy)
                policy["Statement"].append(
                    {
                        "Sid": f"{target_requester_id}",
                        "Effect": "Allow",
                        "Principal": {
                            "AWS": "*"
                        },
                        "Action": "kms:Decrypt",
                        "Resource": "*",
                        "Condition": {
                            "StringLike": {
                                "aws:userId": f"{target_requester_id}:*"
                            }
                        }
                    }
                )
                kms_client.put_key_policy(
                    kms_key_id,
                    json.dumps(policy)
                )

    def delete_target_role_bucket_policy(self):
        logger.info(
            f'Deleting target role from bucket policy for bucket {self.bucket_name}...'
        )
        try:
            s3_client = S3Client(self.source_account_id, self.source_environment.region)
            bucket_policy = json.loads(s3_client.get_bucket_policy(self.bucket_name))
            target_requester_arn = self.get_role_arn(self.target_account_id, self.target_requester_IAMRoleName)
            counter = count()
            statements = {item.get("Sid", next(counter)): item for item in bucket_policy.get("Statement", {})}
            if DATAALL_READ_ONLY_SID in statements.keys():
                principal_list = self.get_principal_list(statements[DATAALL_READ_ONLY_SID])
                if f"{target_requester_arn}" in principal_list:
                    principal_list.remove(f"{target_requester_arn}")
                    if len(principal_list) == 0:
                        statements.pop(DATAALL_READ_ONLY_SID)
                    else:
                        statements[DATAALL_READ_ONLY_SID]["Principal"]["AWS"] = principal_list
                    bucket_policy["Statement"] = list(statements.values())
                    s3_client.create_bucket_policy(self.bucket_name, json.dumps(bucket_policy))
        except Exception as e:
            logger.exception(
                f'Failed during bucket policy management {e}'
            )
            raise e

    def delete_target_role_access_policy(
            self,
            share: ShareObject,
            target_bucket: DatasetBucket,
            target_environment: Environment,
    ):
        logger.info(
            'Deleting target role IAM policy...'
        )
        existing_policy = IAM.get_role_policy(
            target_environment.AwsAccountId,
            share.principalIAMRoleName,
            IAM_S3BUCKET_ROLE_POLICY,
        )
        key_alias = f"alias/{target_bucket.KmsAlias}"
        kms_client = KmsClient(target_bucket.AwsAccountId, target_bucket.region)
        kms_key_id = kms_client.get_key_id(key_alias)
        if existing_policy:
            s3_target_resources = [
                f"arn:aws:s3:::{target_bucket.S3BucketName}",
                f"arn:aws:s3:::{target_bucket.S3BucketName}/*"
            ]
            share_manager = ShareManagerUtils(
                self.session,
                self.dataset,
                self.share,
                self.source_environment,
                self.target_environment,
                self.source_env_group,
                self.env_group
            )
            share_manager.remove_resource_from_statement(existing_policy["Statement"][0], s3_target_resources)
            if kms_key_id:
                kms_target_resources = [
                    f"arn:aws:kms:{target_bucket.region}:{target_bucket.AwsAccountId}:key/{kms_key_id}"
                ]
                if len(existing_policy["Statement"]) > 1:
                    share_manager.remove_resource_from_statement(existing_policy["Statement"][1], kms_target_resources)

            policy_statements = []
            for statement in existing_policy["Statement"]:
                if len(statement["Resource"]) != 0:
                    policy_statements.append(statement)

            existing_policy["Statement"] = policy_statements
            if len(existing_policy["Statement"]) == 0:
                IAM.delete_role_policy(target_environment.AwsAccountId, share.principalIAMRoleName,
                                       IAM_S3BUCKET_ROLE_POLICY)
            else:
                IAM.update_role_policy(
                    target_environment.AwsAccountId,
                    share.principalIAMRoleName,
                    IAM_S3BUCKET_ROLE_POLICY,
                    json.dumps(existing_policy),
                )

    @staticmethod
    def delete_target_role_bucket_key_policy(
            share: ShareObject,
            target_bucket: DatasetBucket,
            target_environment: Environment,
    ):
        if (target_bucket.imported and target_bucket.importedKmsKey) or not target_bucket.imported:
            logger.info(
                'Deleting target role from dataset bucket KMS key policy...'
            )
            key_alias = f"alias/{target_bucket.KmsAlias}"
            kms_client = KmsClient(target_bucket.AwsAccountId, target_bucket.region)
            kms_key_id = kms_client.get_key_id(key_alias)
            existing_policy = kms_client.get_key_policy(kms_key_id)
            target_requester_id = SessionHelper.get_role_id(target_environment.AwsAccountId, share.principalIAMRoleName)
            if existing_policy and f'{target_requester_id}:*' in existing_policy:
                policy = json.loads(existing_policy)
                policy["Statement"] = [item for item in policy["Statement"] if item.get("Sid", None) != f"{target_requester_id}"]
                kms_client.put_key_policy(
                    kms_key_id,
                    json.dumps(policy)
                )

    def handle_share_failure(self, error: Exception) -> bool:
        """
        Handles share failure by raising an alarm to alarmsTopic
        Returns
        -------
        True if alarm published successfully
        """
        logger.error(
            f'Failed to share bucket {self.target_bucket.S3BucketName} '
            f'from source account {self.source_environment.AwsAccountId}//{self.source_environment.region} '
            f'with target account {self.target_environment.AwsAccountId}/{self.target_environment.region} '
            f'due to: {error}'
        )
        DatasetAlarmService().trigger_s3_bucket_sharing_failure_alarm(
            self.target_bucket, self.share, self.target_environment
        )
        return True

    def handle_revoke_failure(self, error: Exception) -> bool:
        """
        Handles share failure by raising an alarm to alarmsTopic
        Returns
        -------
        True if alarm published successfully
        """
        logger.error(
            f'Failed to revoke S3 permissions to bucket {self.bucket_name} '
            f'from source account {self.source_environment.AwsAccountId}//{self.source_environment.region} '
            f'with target account {self.target_environment.AwsAccountId}/{self.target_environment.region} '
            f'due to: {error}'
        )
        DatasetAlarmService().trigger_revoke_folder_sharing_failure_alarm(
            self.target_bucket, self.share, self.target_environment
        )
        return True

    @staticmethod
    def get_role_arn(target_account_id, target_requester_IAMRoleName):
        return f"arn:aws:iam::{target_account_id}:role/{target_requester_IAMRoleName}"

    @staticmethod
    def generate_default_bucket_read_policy_statement(s3_bucket_name, target_requester_arn):
        return {
            "Sid": f"{DATAALL_READ_ONLY_SID}",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    f"{target_requester_arn}"
                ]
            },
            "Action": [
                "s3:List*",
                "s3:GetObject"
            ],
            "Resource": [
                f"arn:aws:s3:::{s3_bucket_name}",
                f"arn:aws:s3:::{s3_bucket_name}/*"
            ]
        }
