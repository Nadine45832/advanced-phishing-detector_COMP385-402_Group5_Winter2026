import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import re
from collections import Counter
import string
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer


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


PUNCTUATION = string.punctuation


def punctuation_stats(text):
    if pd.isna(text):
        return {
            "punct_total": 0,
            "exclamation_count": 0,
            "question_count": 0,
            "dot_count": 0,
            "colon_count": 0,
            "asterics_count": 0,
            "punct_ratio": 0.0
        }

    text = str(text)
    length = len(text)

    punct_total = sum(1 for c in text if c in PUNCTUATION)

    exclamation_count = text.count("!")
    question_count = text.count("?")
    dot_count = text.count(".")
    colon_count = text.count(":")
    asterics_count = text.count("*")

    punct_ratio = punct_total / length if length > 0 else 0.0

    return {
        "punct_total": punct_total,
        "exclamation_count": exclamation_count,
        "question_count": question_count,
        "dot_count": dot_count,
        "colon_count": colon_count,
        "asterics_count": asterics_count,
        "punct_ratio": punct_ratio
    }


def get_most_common_words(text_series, top_n=10):
    words = []

    for text in text_series.dropna():
        # convert to string
        text = str(text).lower()

        # keep only words (remove punctuation & numbers)
        tokens = re.findall(r"\b[a-z]+\b", text)

        # remove stopwords
        tokens = [w for w in tokens if w not in STOPWORDS]

        words.extend(tokens)

    return Counter(words).most_common(top_n)


def get_most_common_words_per_class(df):
    for label in df[LABEL_COLUMN].unique():
        print(f"\nMost common words for class [{label}]:")
        subset = df[df[LABEL_COLUMN] == label][TEXT_COLUMN]

        common_words = get_most_common_words(subset, top_n=15)
        for word, count in common_words:
            print(f"{word}: {count}")


def analyze(df):
    print("\nDataset info:")
    print(df.info())

    print("\nFirst 5 rows:")
    print(df.head())

    print("\nMissing values per column:")
    print(df.isnull().sum())

    print("\nClass distribution:")
    class_counts = df[LABEL_COLUMN].value_counts()
    print(class_counts)

    # Plot class distribution
    class_counts.plot(kind="bar")
    plt.title("Class Distribution")
    plt.xlabel("Class")
    plt.ylabel("Number of Emails")
    plt.xticks(rotation=0)
    plt.show()

    df["text_length"] = df[TEXT_COLUMN].apply(
        lambda x: len(str(x)) if pd.notnull(x) else 0
    )

    print("\nText length statistics:")
    print(df["text_length"].describe())

    df["log_text_length"] = np.log(df["text_length"] + 1)

    for label in df[LABEL_COLUMN].unique():
        plt.hist(
            df[df[LABEL_COLUMN] == label]["log_text_length"],
            bins=50,
            alpha=0.6,
            label=str(label)
        )
    plt.title("Log-Scaled Email Length Distribution")
    plt.xlabel("Log Number of Characters")
    plt.ylabel("Frequency")
    plt.legend()
    plt.show()

    print("\nAverage text length per class:")
    avg_length = df.groupby(LABEL_COLUMN)["text_length"].mean()

    # barchart
    avg_length.plot(kind="bar")
    plt.title("Average Text Length by Class")
    plt.suptitle("")
    plt.xlabel("Class")
    plt.ylabel("Text Length")
    plt.xticks(rotation=0)
    plt.show()

    # words count
    df["word_count"] = df[TEXT_COLUMN].apply(
        lambda x: len(re.findall(r"\b\w+\b", str(x).lower())) if pd.notnull(x) else 0
    )
    print("\nEmail Word Count statistics:")
    print(df["word_count"].describe())
    avg_words_count = df.groupby(LABEL_COLUMN)["word_count"].mean()
    avg_words_count.plot(kind="bar")
    plt.title("Average Email Word Count by Class")
    plt.suptitle("")
    plt.xlabel("Class")
    plt.ylabel("Text Length")
    plt.xticks(rotation=0)
    plt.show()

    df["log_word_count"] = np.log(df["word_count"] + 1)

    for label in df[LABEL_COLUMN].unique():
        plt.hist(
            df[df[LABEL_COLUMN] == label]["log_word_count"],
            bins=50,
            alpha=0.6,
            label=str(label)
        )
    plt.title("Log scaled Email Word Count Distribution")
    plt.xlabel("Number of Words")
    plt.ylabel("Frequency")
    plt.legend()
    plt.show()

    print("\nSample phishing emails:")
    print(df[df[LABEL_COLUMN] == class_counts.index[0]][TEXT_COLUMN].head(2))

    print("\nSample safe emails:")
    print(df[df[LABEL_COLUMN] == class_counts.index[-1]][TEXT_COLUMN].head(2))

    print("\nAverage number of URLs per class:")
    print(df.groupby(LABEL_COLUMN)["url_count"].mean())

    get_most_common_words_per_class(df)

    punct_df = df[TEXT_COLUMN].apply(punctuation_stats).apply(pd.Series)
    df = pd.concat([df, punct_df], axis=1)

    avg_stats = df.groupby(LABEL_COLUMN)[
        [
            "punct_total",
            "exclamation_count",
            "question_count",
            "dot_count",
            "asterics_count",
            "punct_ratio"
        ]
    ].mean()
    avg_stats[
        ["punct_total", "exclamation_count", "question_count", "dot_count", "asterics_count"]
    ].plot(kind="bar")

    plt.title("Average Punctuation Counts by Class")
    plt.xlabel("Class")
    plt.ylabel("Average Count")
    plt.xticks(rotation=0)
    plt.legend(title="Punctuation Type")
    plt.show()


def tfidf_analyz(df, text_column):
    tfidf = TfidfVectorizer(max_features=5000, stop_words='english')
    tfidf_vectors = tfidf.fit_transform(df[text_column])

    tfidf_df = pd.DataFrame(tfidf_vectors.toarray(), columns=tfidf.get_feature_names_out())
    tfidf_df[LABEL_COLUMN] = df[LABEL_COLUMN].values

    mean_tfidf_by_class = tfidf_df.groupby(LABEL_COLUMN).mean()

    top_n = 10
    for label in mean_tfidf_by_class.index:
        print(f"\nTop {top_n} words for class '{label}':")
        top_words = mean_tfidf_by_class.loc[label].sort_values(ascending=False).head(top_n)
        print(top_words)