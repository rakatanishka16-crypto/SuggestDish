import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("builder", pathlib.Path(__file__).resolve().parents[1] / "scripts/build-jalna-priced-menus.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PricedMenuBuilderTests(unittest.TestCase):
    def menu(self, items):
        return {"url": "https://indiarestros.com/r/outlet/menu", "source_url": "https://www.zomato.com/jalna/outlet/order", "source": "zomato", "sections": [{"name": "Snacks", "items": items}]}

    def test_exact_branch_urls_not_same_names_or_other_cities(self):
        self.assertEqual(builder.outlet_url("https://www.zomato.com/hi/jalna/branch-1/order?x=1"), "jalna/branch-1")
        self.assertNotEqual(builder.outlet_url("https://www.zomato.com/jalna/branch-1/order"), builder.outlet_url("https://www.zomato.com/jalna/branch-2/menu"))
        for url in ("https://www.zomato.com/mumbai/branch/order", "https://evil.example/jalna/branch/order", "http://zomato.com/jalna/branch", "https://user:pass@zomato.com/jalna/branch"):
            self.assertIsNone(builder.outlet_url(url))

    def test_only_explicit_numeric_positive_prices_no_guessed_diet_or_copied_text(self):
        items = [{"name": "Poha", "price": 70, "veg": None, "desc": "Do not copy"}]
        items += [{"name": "Invalid", "price": p} for p in (None, True, 0, -1, float("nan"), float("inf"), "100", "80-120", 100001)]
        safe, held = builder.priced_items(self.menu(items), "official:branch", "IRR-EXACT")
        self.assertEqual(len(safe), 1)
        self.assertEqual(len(held), 9)
        self.assertEqual(safe[0]["price_inr"], 70)
        self.assertIsNone(safe[0]["is_veg"])
        self.assertNotIn("desc", safe[0])
        self.assertEqual(safe[0]["source_business_id"], "official:branch")

    def test_conflicting_duplicate_prices_excluded_and_equal_duplicates_collapsed(self):
        safe, held = builder.priced_items(self.menu([{"name": "Poha", "price": 70}, {"name": " POHA ", "price": 80}, {"name": "Tea", "price": 20}, {"name": "Tea", "price": 20}]), "official:branch", "IRR-EXACT")
        self.assertEqual([m["name"] for m in safe], ["Tea"])
        self.assertEqual(held[0]["reason"], "conflicting_duplicate_price_or_diet")


if __name__ == "__main__":
    unittest.main()
