import React, { useEffect, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Card, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { SyncAlt } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import * as PropTypes from 'prop-types';
import { SET_ERROR } from '../../store/errorReducer';
import { useDispatch } from '../../store';
import useClient from '../../hooks/useClient';
import listDatasetTableColumns from '../../api/DatasetTable/listDatasetTableColumns';
import updateColumnDescription from '../../api/DatasetTable/updateDatasetTableColumn';
import syncDatasetTableColumns from '../../api/DatasetTable/syncDatasetTableColumns';
import * as Defaults from '../../components/defaults';
import { QueryResult } from "@apollo/client";

const TableColumns = (props) => {
  const { table, isAdmin } = props;
  const dispatch = useDispatch();
  const client = useClient();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState(null);
  const [refreshingColumns, setRefreshingColumns] = useState(false);

  const updateDescription = async (column, description) => {
    const response = await client.mutate(
      updateColumnDescription({ columnUri: column.id, input: { description } })
    );
    try {
      if (!response.errors) {
        enqueueSnackbar(`Column ${column.name} description updated`, {
          anchorOrigin: {
            horizontal: 'right',
            vertical: 'top'
          },
          variant: 'success'
        });
      } else {
        dispatch({ type: SET_ERROR, error: response.errors[0].message });
      }
    } catch (e) {
      dispatch({ type: SET_ERROR, error: e.message });
    }
  };

  const handleEditCellChangeCommitted = (e:GridCellEditCommitParams) => {
    const data = e.value;
    if (e.field === 'description') {
      columns.map((c) => {
        if (c.id === e.id && data.toString() !== c.description) {
          c.description = data.toString();
          return updateDescription(c, data.toString()).catch((e) =>
            dispatch({ type: SET_ERROR, error: e.message })
          );
        }
        return true;
      });
    }
  };

  const startSyncColumns = async () => {
    try {
      setRefreshingColumns(true);
      const response = await client.mutate(
        syncDatasetTableColumns(table.tableUri)
      );
      if (!response.errors) {
        setColumns(
          response.data.syncDatasetTableColumns.nodes.map((c) => ({
            id: c.columnUri,
            name:
              c.columnType && c.columnType !== 'column'
                ? `${c.name} (${c.columnType})`
                : c.name,
            type: c.typeName,
            description: c.description,
            similarity: c.similarity
          }))
        );
        enqueueSnackbar('Columns synchronized successfully', {
          anchorOrigin: {
            horizontal: 'right',
            vertical: 'top'
          },
          variant: 'success'
        });
      } else {
        dispatch({ type: SET_ERROR, error: response.errors[0].message });
      }
    } catch (e) {
      dispatch({ type: SET_ERROR, error: e.message });
    } finally {
      setRefreshingColumns(false);
    }
  };

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      /*const response = await client.query(
        listDatasetTableColumns({
          tableUri: table.tableUri,
          filter: Defaults.SelectListFilter
        })
      );$/
      // Stub to simulate gql answer 
      /*const gqlResponseString =
     `{
        "data": {
          "listDatasetTableColumns": {
            "count": 4,
            "hasNext": false,
            "hasPrevious": false,
            "nodes": [
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "ihjsdvfd",
                "description": "No description provided",
                "label": "col0",
                "name": "col0",
                "similarity": "null",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "i4sq4875",
                "description": "No description provided",
                "label": "col1",
                "name": "col1",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "l20auntg",
                "description": "No description provided",
                "label": "col2",
                "name": "col2",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "jss6dqbs",
                "description": "No description provided",
                "label": "col3",
                "name": "col3",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              }
            ],
            "page": 1,
            "pages": 1
          }
        }
      }`;*/
      const gqlResponseString = `{
        "data": {
          "listDatasetTableColumns": {
            "count": 27,
            "hasNext": false,
            "hasPrevious": false,
            "nodes": [
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "ojh9ateq",
                "description": "No description provided",
                "label": "customerid",
                "name": "customerid",
                "similarity": "claim:custumerid:80,policy:customerid:79,encounter:cust_nbr:46",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "e4ohvt3z",
                "description": "No description provided",
                "label": "status",
                "name": "status",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "wg48quqq",
                "description": "No description provided",
                "label": "phone",
                "name": "phone",
                "similarity": "encounter:ib_phone:60",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "pwvklwti",
                "description": "No description provided",
                "label": "name",
                "name": "name",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "td9rmcls",
                "description": "No description provided",
                "label": "city",
                "name": "city",
                "similarity": "policy:incident_city:43",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "xravc81r",
                "description": "No description provided",
                "label": "state",
                "name": "state",
                "similarity": "policy:policy_state:49",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "nmxx4jxu",
                "description": "No description provided",
                "label": "zip",
                "name": "zip",
                "similarity": "policy:insured_zip:41",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "bigint"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "svgzmqmb",
                "description": "No description provided",
                "label": "dob",
                "name": "dob",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "qdqad4qd",
                "description": "No description provided",
                "label": "job",
                "name": "job",
                "similarity": "policy:bodily_injuries:25",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "5y1e2k5u",
                "description": "No description provided",
                "label": "email",
                "name": "email",
                "similarity": "encounter:ib_email:60",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "vtflzdpa",
                "description": "No description provided",
                "label": "gender",
                "name": "gender",
                "similarity": "policy:policy_number:30",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "g5zv5k3u",
                "description": "No description provided",
                "label": "startdate",
                "name": "startdate",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "jbbwiejt",
                "description": "No description provided",
                "label": "terminationdate",
                "name": "terminationdate",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "p9k8vtt2",
                "description": "No description provided",
                "label": "agestart",
                "name": "agestart",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "bigint"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "gpnxtkac",
                "description": "No description provided",
                "label": "agelastclaim",
                "name": "agelastclaim",
                "similarity": "policy:injury_claim:41",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "bigint"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "rfgc1942",
                "description": "No description provided",
                "label": "tenure",
                "name": "tenure",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "bigint"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "5dbee75u",
                "description": "No description provided",
                "label": "initialpremium",
                "name": "initialpremium",
                "similarity": "policy:policy_annual_premium:40",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "double"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "5sz2bfa2",
                "description": "No description provided",
                "label": "currentpremium",
                "name": "currentpremium",
                "similarity": "policy:policy_annual_premium:40",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "double"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "zyd7eg5d",
                "description": "No description provided",
                "label": "lastpaydate",
                "name": "lastpaydate",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "gfel6yf4",
                "description": "No description provided",
                "label": "lastclaimdate",
                "name": "lastclaimdate",
                "similarity": "claim:claimdate:62",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "ohcsn231",
                "description": "No description provided",
                "label": "lastclaimamount",
                "name": "lastclaimamount",
                "similarity": "claim:claimamount:65,policy:total_claim_amount:49",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "double"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "hmil3uoj",
                "description": "No description provided",
                "label": "totalpremiums",
                "name": "totalpremiums",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "double"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "heymheni",
                "description": "No description provided",
                "label": "totalclaims",
                "name": "totalclaims",
                "similarity": "policy:total_claim_amount:49",
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "double"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "y5wv1r8q",
                "description": "No description provided",
                "label": "lastcalldate",
                "name": "lastcalldate",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "5j9nr8nh",
                "description": "No description provided",
                "label": "lastcallagent",
                "name": "lastcallagent",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "uy0fcxj8",
                "description": "No description provided",
                "label": "segment",
                "name": "segment",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "string"
              },
              {
                "classification": null,
                "columnType": "column",
                "columnUri": "el4sr9r4",
                "description": "update-description-test-5",
                "label": "agelastpayment",
                "name": "agelastpayment",
                "similarity": null,
                "terms": {
                  "count": 0,
                  "nodes": [],
                  "page": 1,
                  "pages": 0
                },
                "topics": null,
                "typeName": "bigint"
              }
            ],
            "page": 1,
            "pages": 1
          }
        }
      }`

      const response = JSON.parse(gqlResponseString);
      /*const response = {
        data: parsedResponseJSON,
        loading: false, // Set loading to false assuming data is already available
        error: null, // No error in this case
        called: true, // The query has been executed
        client: null, // Provide your ApolloClient instance if available, or set to null if not needed
        networkStatus: 7, // Set the appropriate network status based on your scenario
        refetch: async () => {
          // Implement your refetch logic if needed
          return { data: parsedResponseJSON, loading: false, called: true, client: null, networkStatus: 7 };
        },
      };*/

      if (!response.errors) {
        setColumns(
          response.data.listDatasetTableColumns.nodes.map((c) => ({
            id: c.columnUri,
            name:
              c.columnType && c.columnType !== 'column'
                ? `${c.name} (${c.columnType})`
                : c.name,
            type: c.typeName,
            description: c.description,
            similarity: c.similarity
          }))
        );
      } else {
        dispatch({ type: SET_ERROR, error: response.errors[0].message });
      }
      setLoading(false);
    };
    if (client) {
      fetchItems().catch((e) =>
        dispatch({ type: SET_ERROR, error: e.message })
      );
    }
  }, [client, dispatch, table.tableUri]);

  if (loading) {
    return <CircularProgress />;
  }
  if (!columns) {
    return null;
  }
  const header = [
    { field: 'name', headerName: 'Name', width: 400, editable: false },
    { field: 'type', headerName: 'Type', width: 400, editable: false },
    { field: 'similarity', headerName: 'Similarity', width: 600, editable: false },
    {
      field: 'description',
      headerName: 'Description',
      width: 600,
      editable: isAdmin
    }
  ];

  return (
    <Box>
      {isAdmin && (
        <Box
          sx={{
            display: 'flex',
            flex: 1,
            justifyContent: 'flex-end',
            mb: 2
          }}
        >
          <LoadingButton
            loading={refreshingColumns}
            color="primary"
            onClick={startSyncColumns}
            startIcon={<SyncAlt fontSize="small" />}
            sx={{ m: 1 }}
            variant="outlined"
          >
            Synchronize
          </LoadingButton>
        </Box>
      )}
      <Card sx={{ height: 800, width: '100%' }}>
        {columns.length > 0 && (
          <DataGrid
            rows={columns}
            columns={header}
            onCellEditCommit={handleEditCellChangeCommitted}
          />
        )}
      </Card>
    </Box>
  );
};
TableColumns.propTypes = {
  table: PropTypes.object.isRequired,
  isAdmin: PropTypes.bool.isRequired
};
export default TableColumns;
