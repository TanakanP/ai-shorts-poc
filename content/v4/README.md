# Current V4 backlog

Workbook: `Tell Me Whyyyyyy_ Schedules(1).xlsx`, sheet `Lists`, reviewed 2026-09-13. The active batch is exactly the 16 rows with `Schedule = FALSE`: rows 30, 33 and 42–55. This flag is the workbook proxy for remaining work; publication was not independently checked. Dates are planning metadata, not automatic scheduling.

The previous 14 briefs are preserved in [`../archive/v4-2026-09-12/`](../archive/v4-2026-09-12/). The spreadsheet itself is unchanged.

## Run one topic

Run commands below from the repository root in an interactive terminal with the existing `.env` credentials and dependencies installed. Each command explicitly selects V4, loads its reviewed JSON, and keeps package, visual-proof and story review prompts. On approval it continues through paid services to a voiced local MP4. No commands were run as part of this backlog update.

Hidden mechanisms may need owned/licensed local proof videos. Add `localProof` entries as described in the [project guide](../../README.md#v4-content-generation-opt-in). Empty `localProof` means footage is still to be found and reviewed, not that the topic is visually approved.

### 1. New Zealand’s Kiwi Sniffs With Its Beak Tip

Workbook row 30; planned time `06:00 10/09/2026`. Brief: [`kiwi-beak-tip.json`](kiwi-beak-tip.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/kiwi-beak-tip.json npm run generate -- 'New Zealand’s Kiwi Sniffs With Its Beak Tip' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.tepapa.govt.nz/digital-museum/explore-digital-museum/birds-new-zealand/north-island-brown-kiwi), [Source 2](https://collections.tepapa.govt.nz/topic/1003).

### 2. Australia’s Sporting Colours Echo a Flower

Workbook row 33; planned time `08:00 10/09/2026`. Brief: [`australia-green-gold.json`](australia-green-gold.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/australia-green-gold.json npm run generate -- 'Australia’s Sporting Colours Echo a Flower' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.pmc.gov.au/honours-and-symbols/australian-national-symbols/australian-national-colours).

### 3. Road Signs Shine by Throwing Your Headlights Back

Workbook row 42; planned time `02:00 14/09/2026`. Brief: [`road-sign-retroreflection.json`](road-sign-retroreflection.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/road-sign-retroreflection.json npm run generate -- 'Road Signs Shine by Throwing Your Headlights Back' "Use the reviewed brief"
```

Title adjusted from “Night Road Signs Have No Power—Headlights Do the Work” to “Road Signs Can Shine Without Their Own Power” to respect the topic’s factual scope.

Fact references: [Source 1](https://highways.fhwa.dot.gov/safety/other/visibility/workshops-nighttime-visibility-traffic-signs-summary-workshop-findings-13).

### 4. Traffic Lights Can Detect Your Car Through Wires in the Road

Workbook row 43; planned time `04:00 14/09/2026`. Brief: [`traffic-light-loops.json`](traffic-light-loops.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/traffic-light-loops.json npm run generate -- 'Traffic Lights Can Detect Your Car Through Wires in the Road' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.fhwa.dot.gov/publications/research/operations/its/06108/02.cfm).

### 5. A Store Barcode Usually Identifies the Product, Not the Price

Workbook row 44; planned time `02:00 15/09/2026`. Brief: [`barcode-product-id.json`](barcode-product-id.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/barcode-product-id.json npm run generate -- 'A Store Barcode Usually Identifies the Product, Not the Price' "Use the reviewed brief"
```

Title adjusted from “Store Barcodes Never Carry the Price” to “Store Barcodes Usually Identify Products, Not Prices” to respect the topic’s factual scope.

Fact references: [Source 1](https://support.gs1.org/support/solutions/articles/43000734158-are-the-description-and-price-of-the-item-included-in-the-barcode-).

### 6. QR Codes Use Three Big Squares to Know Their Orientation

Workbook row 45; planned time `04:00 15/09/2026`. Brief: [`qr-code-corners.json`](qr-code-corners.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/qr-code-corners.json npm run generate -- 'QR Codes Use Three Big Squares to Know Their Orientation' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.qrcode.com/en/about/featurePage/featurePage5.html), [Source 2](https://www.qrcode.com/en/about/error_correction.html).

### 7. A Microwave Door Is Full of Holes That Still Trap Microwave Energy

Workbook row 46; planned time `02:00 16/09/2026`. Brief: [`microwave-door-mesh.json`](microwave-door-mesh.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/microwave-door-mesh.json npm run generate -- 'A Microwave Door Is Full of Holes That Still Trap Microwave Energy' "Use the reviewed brief"
```

Fact references: [Source 1](https://products.geappliances.com/appliance/gea-support-search-content?contentId=39714), [Source 2](https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens).

### 8. A Frost-Free Freezer Heats Itself on Purpose

Workbook row 47; planned time `04:00 16/09/2026`. Brief: [`freezer-defrost-heater.json`](freezer-defrost-heater.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/freezer-defrost-heater.json npm run generate -- 'A Frost-Free Freezer Heats Itself on Purpose' "Use the reviewed brief"
```

Fact references: [Source 1](https://products.geappliances.com/appliance/gea-support-search-content?contentId=16679), [Source 2](https://products.geappliances.com/appliance/gea-support-search-content?contentId=19471).

### 9. A Dishwasher Waits Before Releasing the Detergent

Workbook row 48; planned time `02:00 17/09/2026`. Brief: [`dishwasher-detergent-timing.json`](dishwasher-detergent-timing.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/dishwasher-detergent-timing.json npm run generate -- 'A Dishwasher Waits Before Releasing the Detergent' "Use the reviewed brief"
```

Title adjusted from “Dishwashers Hide Soap Until Mid-Cycle” to “Dishwashers Time When They Release Detergent” to respect the topic’s factual scope.

Fact references: [Source 1](https://media3.bosch-home.com/Documents/9001308708_C.pdf).

### 10. A Toilet Uses Standing Water as a Sewer-Gas Seal

Workbook row 49; planned time `04:00 17/09/2026`. Brief: [`toilet-water-seal.json`](toilet-water-seal.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/toilet-water-seal.json npm run generate -- 'A Toilet Uses Standing Water as a Sewer-Gas Seal' "Use the reviewed brief"
```

Fact references: [Source 1](https://assist.kohler.com/en/toilets-and-seats/How-a-Toilet-Flushes), [Source 2](https://www.sdsdut.gov/what-s-that-smell-understanding-sewer-odors-and-p-traps).

### 11. A Seat Belt Stays Loose Until a Sudden Stop Makes It Lock

Workbook row 50; planned time `02:00 18/09/2026`. Brief: [`seat-belt-lock.json`](seat-belt-lock.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/seat-belt-lock.json npm run generate -- 'A Seat Belt Stays Loose Until a Sudden Stop Makes It Lock' "Use the reviewed brief"
```

Title adjusted from “Seat Belts Stay Loose Until the Crash Hits” to “Seat Belts Can Lock Before a Crash” to respect the topic’s factual scope.

Fact references: [Source 1](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1697247&Uid=G1688532&buildtype=web&countryCode=USA&div=f&languageCode=en&moidRef=G910645&userMarket=CAN&vFilteringEnabled=False&variantid=6057).

### 12. A Car Headrest Is Built for Rear-End Crashes, Not Just Comfort

Workbook row 51; planned time `04:00 18/09/2026`. Brief: [`headrest-crash-safety.json`](headrest-crash-safety.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/headrest-crash-safety.json npm run generate -- 'A Car Headrest Is Built for Rear-End Crashes, Not Just Comfort' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.iihs.org/ratings/about-our-tests/head-restraints), [Source 2](https://www.transportation.gov/regulations/federal-register-documents/07-2011).

### 13. A Pen-Cap Hole Is an Airway Safety Feature

Workbook row 52; planned time `02:00 19/09/2026`. Brief: [`pen-cap-hole.json`](pen-cap-hole.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/pen-cap-hole.json npm run generate -- 'A Pen-Cap Hole Is an Airway Safety Feature' "Use the reviewed brief"
```

Title adjusted from “Pen-Cap Holes Exist Because Caps Get Swallowed” to “The Pen-Cap Hole Has an Airway Safety Job” to respect the topic’s factual scope.

Fact references: [Source 1](https://us.bic.com/en_us/stationary-faq).

### 14. The Star on an Elevator Button Marks the Main Entry Floor

Workbook row 53; planned time `04:00 19/09/2026`. Brief: [`elevator-star.json`](elevator-star.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/elevator-star.json npm run generate -- 'The Star on an Elevator Button Marks the Main Entry Floor' "Use the reviewed brief"
```

Title adjusted from “Elevator Stars Mark the Official Main Floor” to “The Elevator Star Marks the Main Entry Floor in the U.S.” to respect the topic’s factual scope.

Fact references: [Source 1](https://www.access-board.gov/ada/chapter/ch04/).

### 15. A Chip Card Creates a One-Time Security Code for Every Purchase

Workbook row 54; planned time `02:00 20/09/2026`. Brief: [`chip-card-cryptogram.json`](chip-card-cryptogram.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/chip-card-cryptogram.json npm run generate -- 'A Chip Card Creates a One-Time Security Code for Every Purchase' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.emvco.com/emv-technologies/emv-contact-chip/).

### 16. Your Baggage Tag Is the Machine-Readable ID That Routes Your Suitcase

Workbook row 55; planned time `04:00 20/09/2026`. Brief: [`baggage-tag-routing.json`](baggage-tag-routing.json).

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/baggage-tag-routing.json npm run generate -- 'Your Baggage Tag Is the Machine-Readable ID That Routes Your Suitcase' "Use the reviewed brief"
```

Fact references: [Source 1](https://www.iata.org/contentassets/d22bcfe86aa54f22a2919b0e4224f68f/reso753-implementation-guide---2023_issue-4.0.pdf), [Source 2](https://www.iata.org/en/programs/ops-infra/baggage/baggage-tracking).

## Editorial adjustments

The workbook briefs were treated as content input. Their story clocks were adapted to the implemented V4 timing gates, including the channel sign-off. Road-sign footage opens on the bright result. Hidden-mechanism illustrations require supplied local video rather than an unimplemented animation feature.

Kiwi uses a distinct second reveal about the little spotted kiwi’s smell-processing brain region. Australia uses official adoption in 1984 as its second reveal. Both preserve the original topic and avoid repeating the first fact. Barcode pricing differences are an inference from GS1’s database-lookup explanation. Microwave coverage focuses on the screen and interlocks; QR coverage separates orientation from error correction. Baggage tracking records are kept in the handling system, not on the printed strip.

Six title seeds were narrowed (road signs, barcode, dishwasher, seat belt, pen cap and elevator); the elevator description also states U.S. scope. Original title and description cells are preserved in the [dated workbook snapshot](../../docs/content-v4/unposted-workbook-snapshot-2026-09-13.json).
