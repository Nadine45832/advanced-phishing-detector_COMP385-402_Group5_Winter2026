from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.base import BaseEstimator, TransformerMixin
import scipy.sparse as sp


URL_FEAT_COLS = [
    "url_count", "avg_url_len", "max_url_len",
    "has_ip_url", "suspicious_tld",
    "url_digit_ratio", "url_hyphen_count"
]

CLEAN_TEXT_COLUMN = "clean_email_text"


class DenseToSparse(BaseEstimator, TransformerMixin):
    def __init__(self, cols): self.cols = cols

    def fit(self, X, y=None):
        self.scaler_ = StandardScaler()
        self.scaler_.fit(X[self.cols].astype(float).values)
        return self

    def transform(self, X):
        dense = self.scaler_.transform(X[self.cols].astype(float).values)
        return sp.csr_matrix(dense)


class HybridFeatures(BaseEstimator, TransformerMixin):
    def __init__(self, tfidf_params=None):
        self.tfidf_params = tfidf_params or {}

    def fit(self, X, y=None):
        self.tfidf_ = TfidfVectorizer(**self.tfidf_params)
        self.tfidf_.fit(X[CLEAN_TEXT_COLUMN])
        self.url_scaler_ = DenseToSparse(URL_FEAT_COLS)
        self.url_scaler_.fit(X)
        return self

    def transform(self, X):
        text_mat = self.tfidf_.transform(X[CLEAN_TEXT_COLUMN])
        url_mat = self.url_scaler_.transform(X)
        return sp.hstack([text_mat, url_mat], format="csr")


DEFAULT_TFIDF = dict(
    max_features=20_000,
    ngram_range=(1, 3),
    sublinear_tf=True,
    min_df=2,
    analyzer="word",
)


def create_model():
    return Pipeline([
        ("features", HybridFeatures(DEFAULT_TFIDF)),
        ("clf",      LogisticRegression(
            max_iter=5000, solver="saga", class_weight="balanced"
        )),
    ])
