import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
import random
import string
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

URL_REGEX = re.compile(
    r"(?:(?:https?://|www\.)\S+|\b[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|co|io|ru|tk|info|biz)(?:/\S*)?)",
    flags=re.IGNORECASE
)


def get_synonyms(word, pos=None):
    synonyms = set()
    for syn in wordnet.synsets(word, pos=pos):
        for lemma in syn.lemmas():
            synonym = lemma.name().replace('_', ' ')
            if synonym.lower() != word.lower():
                synonyms.add(synonym)
    return list(synonyms)


def synonym_replacement(text, n=3):
    words = text.split(' ')
    replaceable = [(i, w.strip('.,!?;:')) for i, w in enumerate(words) 
                   if len(w.strip('.,!?;:')) > 3 and w.isalpha()]

    if len(replaceable) < n:
        n = len(replaceable)

    to_replace = random.sample(replaceable, n)
    new_words = words.copy()
    replaced_words = []

    for idx, word in to_replace:
        synonyms = get_synonyms(word.lower())

        if synonyms:
            replacement = random.choice(synonyms)
            replaced_words.append((new_words[idx], replacement))
            new_words[idx] = replacement

    return ' '.join(new_words), replaced_words


def augment_phishing_class(df, n=3, amount=1000):
    safe_emails = df[df[LABEL_COLUMN] != PHYSHING_LABEL]
    phishing_emails = df[df[LABEL_COLUMN] == PHYSHING_LABEL]

    samples_needed = amount if amount > 0 else len(safe_emails) - len(phishing_emails)
    print(f"Need to generate: {samples_needed} samples")

    augmented_samples = []
    generated = 0

    examples_to_compare = []

    while generated < samples_needed:
        for _, row in phishing_emails.iterrows():
            if generated >= samples_needed:
                break

            original_tokens = row[CLEAN_TEXT_COLUMN]

            # remove too short emails
            if pd.isna(original_tokens) or len(str(original_tokens).strip()) < 5:
                continue

            augmented_tokens, replaced_words = synonym_replacement(original_tokens, n)

            new_row = row.copy()
            new_row[CLEAN_TEXT_COLUMN] = augmented_tokens
            for old_word, new_word in replaced_words:
                new_row[TEXT_COLUMN] = new_row[TEXT_COLUMN].replace(old_word, new_word)
            augmented_samples.append(new_row)

            examples_to_compare.append((row[CLEAN_TEXT_COLUMN], new_row[CLEAN_TEXT_COLUMN]))

            generated += 1

    print(f"Total {generated}")

    augmented_df = pd.DataFrame(augmented_samples)
    balanced_df = pd.concat([safe_emails, phishing_emails, augmented_df], 
                            ignore_index=True)

    print("Agumented examples:")
    for old_text, new_text in examples_to_compare[:10]:
        print(f"\nOld: {old_text}, \nNew: {new_text}")

    print("\nClass distribution After augumentation:")
    class_counts = balanced_df[LABEL_COLUMN].value_counts()
    print(class_counts)

    return balanced_df


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


def get_urls(text):
    if pd.isna(text):
        return []
    return URL_REGEX.findall(str(text))


def replace_email_urls(text):
    if pd.isna(text):
        return text
    return URL_REGEX.sub("<URL>", str(text))


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


def transform_data(df):
    df["urls"] = df[TEXT_COLUMN].apply(get_urls)

    df["url_count"] = df["urls"].apply(len)

    punct_df = df[TEXT_COLUMN].apply(punctuation_stats).apply(pd.Series)

    df = pd.concat([df, punct_df], axis=1)

    df[TEXT_COLUMN] = df[TEXT_COLUMN].apply(replace_email_urls)
    return df


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


def main():
    df = pd.read_csv(CSV_PATH)

    duplicate_count = df.duplicated().sum()
    print(f"\nNumber of duplicate rows: {duplicate_count}")

    # basic transform, remove link and store them separatly
    df = transform_data(df)

    # analyze(df)

    df[CLEAN_TEXT_COLUMN] = df[TEXT_COLUMN].apply(clean_text)
    # tfidf_analyz(df, CLEAN_TEXT_COLUMN)

    df = augment_phishing_class(df)


main()
