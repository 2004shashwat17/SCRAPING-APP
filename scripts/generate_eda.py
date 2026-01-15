#!/usr/bin/env python3
"""Generate cleaned EDA CSV from raw scraped CSV.

Usage:
    python scripts/generate_eda.py --input /path/to/0_<fbid>.csv --output /path/to/1_<fbid>.csv

Exits with code 0 on success; non-zero on failure.
"""

import argparse
import logging
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError as e:
    print("Missing dependency 'pandas'. Install with: pip install pandas", file=sys.stderr)
    raise


def unique_join(series):
    # series: pandas Series
    vals = [str(x).strip() for x in series.dropna().astype(str)]
    vals = sorted(set([v for v in vals if v]))
    return ",".join(vals)


def make_cli():
    p = argparse.ArgumentParser(description='Generate cleaned EDA CSV from raw scraped CSV')
    p.add_argument('--input', '-i', required=True, help='Input raw CSV path (e.g. 0_<fbid>.csv)')
    p.add_argument('--output', '-o', required=True, help='Output cleaned CSV path (e.g. 1_<fbid>.csv)')
    p.add_argument('--force', action='store_true', help='Overwrite output if it exists')
    return p


def main(argv=None):
    parser = make_cli()
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        logging.error('Input file not found: %s', input_path)
        return 2

    if output_path.exists() and not args.force:
        logging.error('Output file already exists: %s (use --force to overwrite)', output_path)
        return 3

    try:
        df = pd.read_csv(input_path)
    except Exception as e:
        logging.exception('Failed to read input CSV: %s', e)
        return 4

    # Columns configuration (based on notebook logic)
    interaction_cols = [
        'who_commented',
        'what_comment',
        'who_liked',
        'who_shared',
        'shared_url'
    ]

    numeric_cols = [
        'like_count',
        'comment_count',
        'share_count',
        'level'
    ]

    # meta columns: everything else except interactions & numeric
    meta_cols = [col for col in df.columns if col not in interaction_cols + numeric_cols]

    agg_dict = {}
    # metadata -> first
    for col in meta_cols:
        agg_dict[col] = 'first'

    # numeric -> max
    for col in numeric_cols:
        if col in df.columns:
            agg_dict[col] = 'max'

    # interactions -> unique join
    for col in interaction_cols:
        if col in df.columns:
            agg_dict[col] = lambda x: unique_join(x)

    if 'post_no' not in df.columns:
        logging.error('Input CSV missing required column: post_no')
        return 5

    try:
        cleaned_post_df = df.groupby('post_no', as_index=False).agg(agg_dict)
    except Exception as e:
        logging.exception('Aggregation failed: %s', e)
        return 6

    # Ensure numeric columns exist
    for col in ['like_count', 'comment_count', 'share_count']:
        if col not in cleaned_post_df.columns:
            cleaned_post_df[col] = 0

    # Compute post_score
    try:
        cleaned_post_df['post_score'] = (
            cleaned_post_df['like_count'].fillna(0).astype(float) * 1 +
            cleaned_post_df['comment_count'].fillna(0).astype(float) * 7 +
            cleaned_post_df['share_count'].fillna(0).astype(float) * 14
        )
    except Exception as e:
        logging.exception('Failed computing post_score: %s', e)
        return 7

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cleaned_post_df.to_csv(output_path, index=False)
    except Exception as e:
        logging.exception('Failed to write output CSV: %s', e)
        return 8

    print('Generated cleaned EDA:', output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
