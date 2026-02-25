import pandas as pd
import nltk
from nltk.corpus import stopwords
from sklearn.model_selection import train_test_split
from augment_emails import augment_phishing_class
from evaluate_model import evaluate_models
import joblib
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.clean_text import url_features, replace_email_urls, get_urls, clean_text
from shared.models import create_model, URL_FEAT_COLS


CSV_PATH = "emails.csv"
TEXT_COLUMN = "email_text"
CLEAN_TEXT_COLUMN = "clean_email_text"
LABEL_COLUMN = "email_type"
PHYSHING_LABEL = "Phishing Email"

nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('omw-1.4')
nltk.download('punkt')
nltk.download('averaged_perceptron_tagger')
nltk.download('punkt_tab')
STOPWORDS = set(stopwords.words("english"))


def transform_data(df):
    df["urls"] = df[TEXT_COLUMN].apply(get_urls)

    url_feat_df = df["urls"].apply(url_features).apply(pd.Series)
    df = pd.concat([df, url_feat_df], axis=1)

    df[TEXT_COLUMN] = df[TEXT_COLUMN].apply(replace_email_urls)
    return df


def prepare(df):
    duplicate_count = df.duplicated().sum()
    print(f"\nNumber of duplicate rows: {duplicate_count}")

    # basic transform, remove link and store them separatly
    df = transform_data(df)

    df[CLEAN_TEXT_COLUMN] = df[TEXT_COLUMN].apply(clean_text)

    df = augment_phishing_class(df)
    return df


def main():
    df = pd.read_csv(CSV_PATH)

    df = prepare(df)

    # analyze(df)
    # tfidf_analyz(df, CLEAN_TEXT_COLUMN)
    model = create_model()

    X = df[[CLEAN_TEXT_COLUMN] + URL_FEAT_COLS]
    y = df[LABEL_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=47
    )

    model.fit(X_train, y_train)
    evaluate_models(model, X_test, y_test)

    joblib.dump(model, "phishing_model.pkl")


main()
