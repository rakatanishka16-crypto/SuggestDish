import json, sys
from pathlib import Path
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
rows=json.loads(src.read_text())
columns='"sourceKey",name,category,address,city,latitude,longitude,"sourceUrl","sourceLicense","reviewStatus"'
schema='"sourceKey" text,name text,category text,address text,city text,latitude double precision,longitude double precision,"sourceUrl" text,"sourceLicense" text,"reviewStatus" text'
for i in range(0,len(rows),1500):
 payload=json.dumps(rows[i:i+1500],ensure_ascii=False,separators=(',',':')).replace("'","''")
 query=f'''WITH inserted AS (INSERT INTO public."HorecaCandidate" ({columns}) SELECT {columns} FROM jsonb_to_recordset('{payload}'::jsonb) AS x({schema}) ON CONFLICT ("sourceKey") DO NOTHING RETURNING id) SELECT COUNT(*) AS inserted FROM inserted;'''
 (out/f'batch-{i//1500:04d}.sql').write_text(query)
print(json.dumps({'sourceObjects':len(rows),'batches':(len(rows)+1499)//1500}))
