import pandas as pd
import numpy as np
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from augment_emails import augment_phishing_class
from analyze_data import analyze, tfidf_analyz
from evaluate_model import evaluate_models
from models import create_model, URL_FEAT_COLS
from sklearn.model_selection import train_test_split
import joblib


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
lemmatizer = WordNetLemmatizer()

URL_REGEX = re.compile(
    r"(?:(?:https?://|www\.)\S+|\b[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|co|io|ru|tk|info|biz)(?:/\S*)?)",
    flags=re.IGNORECASE
)


def clean_text(text):
    if pd.isnull(text):
        return ""

    text = text.lower()
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'[^a-z0-9\s]', '', text)
    words = [word for word in text.split() if word not in STOPWORDS]
    words = [w for w in words if w.isalpha()]
    words = [lemmatizer.lemmatize(word) for word in words]

    return ' '.join(words)


def get_urls(text):
    if pd.isna(text):
        return []
    return URL_REGEX.findall(str(text))


def replace_email_urls(text):
    if pd.isna(text):
        return text
    return URL_REGEX.sub("<URL>", str(text))


def transform_data(df):
    df["urls"] = df[TEXT_COLUMN].apply(get_urls)

    url_feat_df = df["urls"].apply(url_features).apply(pd.Series)
    df = pd.concat([df, url_feat_df], axis=1)

    df[TEXT_COLUMN] = df[TEXT_COLUMN].apply(replace_email_urls)
    return df


def url_features(urls):
    empty = {
        "url_count": 0, "avg_url_len": 0, "max_url_len": 0,
        "has_ip_url": 0, "suspicious_tld": 0,
        "url_digit_ratio": 0, "url_hyphen_count": 0,
    }
    if not urls:
        return empty

    ip_pattern = re.compile(r"https?://\d{1,3}(?:\.\d{1,3}){3}")
    bad_tlds   = {".xyz", ".top", ".tk", ".ml", ".ga", ".cf", ".gq", ".pw"}
    lengths    = [len(u) for u in urls]
    all_chars  = "".join(urls)

    return {
        "url_count":        len(urls),
        "avg_url_len":      float(np.mean(lengths)),
        "max_url_len":      float(max(lengths)),
        "has_ip_url":       int(any(ip_pattern.match(u) for u in urls)),
        "suspicious_tld":   int(any(u.split("?")[0].endswith(t) for u in urls for t in bad_tlds)),
        "url_digit_ratio":  sum(c.isdigit() for c in all_chars) / max(len(all_chars), 1),
        "url_hyphen_count": float(all_chars.count("-")),
    }


def prepare(df):
    duplicate_count = df.duplicated().sum()
    print(f"\nNumber of duplicate rows: {duplicate_count}")
    
    print(df.head(3))
    print(df.shape)

    # basic transform, remove link and store them separatly
    df = transform_data(df)

    print(df.head(3))
    print(df.shape)

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
