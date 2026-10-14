# Mumbai menu follow-up: Hopleaf and Hotel Samraj

130 new outlet-linked food records: Hopleaf Borivali West 92 (85 eligible,
7 grouped variants held); Hotel Samraj Andheri East 38 (28 eligible, 10 held).
The 17 grouped choices remain source evidence. No variant is guessed or split.

Sources checked on 14 October 2026:
- https://www.hopleaf.in/
- https://www.hotelsamraj.com/hotelsamrajmenu?location=Location+1&menu=starters-veg
- https://www.hotelsamraj.com/hotelsamrajmenu?location=Location+1&menu=main-course-vegetarian
- https://www.hotelsamraj.com/hotelsamrajmenu?location=Location+1&menu=main-course-non-vegetarian

Hopleaf's pure vegetarian statement and Samraj's explicit dietary section
headings supply flags. Hopleaf taxes are additional. Current stock, effective
price date, coordinates and owner verification remain unknown. Recipe flavour
and preparation are unverified. No photos, descriptions or ratings are copied.

Hopleaf keeps its existing source key and all 36 earlier records. The new menu
association contains 128 rows; the scoped import selects only the 92 new IDs.
Pizza and sizzler section context is included in dish names to avoid treating
Paneer Tikka Pizza as a standalone starter.

The authenticated /api/catalogue-import endpoint accepts scope
`mumbai-hopleaf-samraj-2026-10-14` for all plan/archive/publish calls. Its plan has
2 outlets, 262 evidence records, 113 eligible dishes and 17 held associations.
Each scope has a separate cached digest; wrong digests and unknown scopes fail
before connecting to PostgreSQL. Existing prices and diets are never replaced.
Temporary access must be disabled and redeployed after a verified import.

This is partial Mumbai coverage. Source preparation, deployment and database
import are separate steps; preparation does not claim the records are live.
