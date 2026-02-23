import pandas as pd
import nltk
from nltk.corpus import wordnet
import random

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