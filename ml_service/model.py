import pandas as pd
import numpy as np

# Dummy model: computes simple statistics and a fake "score" per row
# Replace this with a real ML model later.

def predict_from_csv(csv_path: str, user_id: str):
    # Read CSV
    df = pd.read_csv(csv_path)

    # Simple feature: count non-null columns per row
    df['_nonnull_count'] = df.notnull().sum(axis=1)

    # Fake score: normalized nonnull count
    if df.empty:
        return {
            'summary': 'empty_csv',
            'rows': 0,
            'top_rows': []
        }

    max_cnt = df['_nonnull_count'].max() or 1
    df['score'] = (df['_nonnull_count'] / max_cnt).round(3)

    # Return top 3 rows by score with some columns
    top = df.sort_values('score', ascending=False).head(3)
    top_rows = top.drop(columns=['_nonnull_count', 'score']).to_dict(orient='records')

    result = {
        'summary': {
            'rows': len(df),
            'columns': list(df.columns.drop(['_nonnull_count', 'score']))
        },
        'top_rows': top_rows,
        'scores': top['score'].tolist()
    }

    return result
