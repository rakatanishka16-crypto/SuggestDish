import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("followup_builder", ROOT / "scripts/build-jalna-menu-followup.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BranchReviewTests(unittest.TestCase):
    def test_changed_source_branch_address_fails_before_any_menu_publication(self):
        review = json.loads((ROOT / "api/source-batches/jalna-menu-branch-reviews-2026-10-27.json").read_text())["reviews"][0]
        id = review["provider_id"]
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder)
            detail = {"id": id, "address": {"city": "Jalna", "street": "A different branch address"}, "sources": [{"url": review["expected_upstream_url"]}]}
            menu = {"restaurant": id, "source_url": review["expected_upstream_url"]}
            (path / (id + ".detail.json")).write_text(json.dumps(detail))
            (path / (id + ".menu.json")).write_text(json.dumps(menu))
            with self.assertRaisesRegex(ValueError, "Reviewed branch identity changed"):
                builder.build([folder])


if __name__ == "__main__":
    unittest.main()
