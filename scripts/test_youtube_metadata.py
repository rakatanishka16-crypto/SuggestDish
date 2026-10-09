import importlib.util,unittest,datetime as dt,tempfile,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('collect-youtube-metadata.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_expiry(self):
  n=dt.datetime(2026,10,9,tzinfo=dt.timezone.utc);self.assertFalse(m.fresh((n-dt.timedelta(days=30)).isoformat(),n,30));self.assertTrue(m.fresh(n.isoformat(),n,30))
 def test_metadata_no_mentions(self):
  class Fake:
   def get(self,method,params):
    if method=='search':return {'items':[{'id':{'videoId':'abc'}}]},m.now().isoformat()
    return {'items':[{'id':'abc','snippet':{'title':'Food Mumbai','description':'Original text'},'statistics':{'viewCount':'7'}}]},m.now().isoformat()
  rows=m.collect(Fake());self.assertEqual(len(rows),1);self.assertEqual(rows[0]['view_count'],'7');self.assertEqual(rows[0]['description'],'Original text');self.assertNotIn('dish_name',rows[0])
 def test_purge(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'raw';p.mkdir();f=p/'old.json';f.write_text(json.dumps({'retrieved_at':(m.now()-dt.timedelta(days=31)).isoformat(),'response':{}}));self.assertEqual(m.purge(d),1);self.assertFalse(f.exists())
if __name__=='__main__':unittest.main()
