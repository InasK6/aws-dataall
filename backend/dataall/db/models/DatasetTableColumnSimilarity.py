from sqlalchemy import Column, String, Float

from .. import Base
from .. import Resource, utils


class DatasetTableColumnSimilarity(Base):
    __tablename__ = 'dataset_table_column_similarity'
    columnUri = Column(String, primary_key=True, default=utils.uuid('col'))
    SourceGlueTableName = Column(String, nullable=False)
    SourceColumnName = Column(String, nullable=False)
    TargetGlueTableName = Column(String, nullable=False)
    TargetColumnName = Column(String, nullable=False)
    SimilarityScore = Column(Float, nullable=False)