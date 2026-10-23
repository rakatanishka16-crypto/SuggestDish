#!/usr/bin/env python3
"""Publish only the reviewed Mumbai snapshot through the private scoped API.

Default is a read-only plan. Add --apply for digest-bound transactional writes.
Configure SOURCE_CATALOG_IMPORT_KEY privately, or SUGGESTDISH_IMPORT_KEY_FILE.
Never paste or commit credentials. Disable temporary import access after use.
"""
import argparse
import json
import os
from pathlib import Path
import urllib.request

SCOPE = 'mumbai-official-menu-expansion-2026-10-23'
ENDPOINT = 'https://www.suggestdish.com/api/catalogue-import'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', default='mumbai-oct23-import-report.json')
    args = parser.parse_args()
    key = os.environ.get('SOURCE_CATALOG_IMPORT_KEY', '')
    if not key and os.environ.get('SUGGESTDISH_IMPORT_KEY_FILE'):
        key = Path(os.environ['SUGGESTDISH_IMPORT_KEY_FILE']).read_text().strip()
    if len(key) < 32:
        raise SystemExit('Configure the private import credential; do not paste it into chat.')
    def call(**payload):
        body = json.dumps(dict(scope=SCOPE, **payload)).encode()
        req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.load(response)
        if not result.get('success'):
            raise RuntimeError('Import request failed.')
        return result
    plan = call(stage='plan')
    print(json.dumps(plan), flush=True)
    if plan['promotionDishes'] != 347 or plan['promotionOutlets'] != 2 or plan['promotionOutletCities'] != {'Mumbai':2}:
        raise SystemExit('Unexpected scope counts; inspect before writing.')
    report = {'scope':SCOPE, 'plan':plan, 'batches':[], 'completed':False}
    if not args.apply:
        return
    for stage in ['archive','publish']:
        offset = 0
        while True:
            batch = call(stage=stage, offset=offset, digest=plan['digest'])
            report['batches'].append(batch)
            Path(args.report).write_text(json.dumps(report, indent=2)+'\n')
            print(json.dumps(batch), flush=True)
            if batch['done']:
                break
            if batch['nextOffset'] <= offset:
                raise RuntimeError('Import did not advance.')
            offset = batch['nextOffset']
    report['completed'] = True
    Path(args.report).write_text(json.dumps(report, indent=2)+'\n')

if __name__ == '__main__':
    main()
