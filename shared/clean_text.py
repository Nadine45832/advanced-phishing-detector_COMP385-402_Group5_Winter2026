import pandas as pd
import numpy as np
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer


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


def transform_email_text(email_text):
    urls = get_urls(email_text)
    url_dict = url_features(urls)

    return replace_email_urls(email_text), url_dict


def url_features(urls):
    empty = {
        "url_count": 0, "avg_url_len": 0, "max_url_len": 0,
        "has_ip_url": 0, "suspicious_tld": 0,
        "url_digit_ratio": 0, "url_hyphen_count": 0,
    }
    if not urls:
        return empty

    ip_pattern = re.compile(r"https?://\d{1,3}(?:\.\d{1,3}){3}")
    bad_tlds = {".xyz", ".top", ".tk", ".ml", ".ga", ".cf", ".gq", ".pw"}
    lengths = [len(u) for u in urls]
    all_chars = "".join(urls)

    return {
        "url_count":        len(urls),
        "avg_url_len":      float(np.mean(lengths)),
        "max_url_len":      float(max(lengths)),
        "has_ip_url":       int(any(ip_pattern.match(u) for u in urls)),
        "suspicious_tld":   int(any(u.split("?")[0].endswith(t) for u in urls for t in bad_tlds)),
        "url_digit_ratio":  sum(c.isdigit() for c in all_chars) / max(len(all_chars), 1),
        "url_hyphen_count": float(all_chars.count("-")),
    }
