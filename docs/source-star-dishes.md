# Published-menu dish features

Public menu evidence is stored separately from verified ownership claims in SourceStarDish. One active source feature is allowed per restaurant. A menu-labelled bestseller is a restaurant-published claim, not audited order volume. A signature selection is one of the restaurant's published signature items, not a most-ordered claim.

The first batch checked on 4 October 2026 (India time):
- The Couch Potato, WTC Cuffe Parade: Mumbai Chaat Spud (regular), INR 179, vegetarian, labelled Bestseller. https://www.thecouchpotato.co.in/
- A Petal and Paniyaram, Goregaon West: Masala Paniyaram, INR 130, vegetarian, included in Our Signature Specialties. https://www.petalandpaniyaram.in/menu/

Source records expire after 60 days unless checked again. Expired features return to labelled unconfirmed menu suggestions; the historic menu prices still need checking. Approved owner dishes take precedence over source features. Active paid slots apply only to reviewed owner dishes and captured live payments. Source records grant no ownership or subscription.

Deploy migrations/source-star-dishes.sql before the updated API. The first batch is data/stars/mumbai-official-menu.sql; it asserts exact dish, price, diet and restaurant matches before inserting, and can be rerun without duplicating features.
