# Sources & Data Backing

Reading this correctly: figures about SSB's own BOP count and border length are consistent and well-sourced. Figures about camera/sensor deployments elsewhere (BSF, Punjab, CIBMS) are real and sourced but describe *other forces'* infrastructure, not confirmed SSB infrastructure. IBVAP's own cost figures are original engineering estimates with no external source.

## National/border figures

| Claim / figure | Source | Caveat |
|---|---|---|
| 734 total SSB Border Out Posts (539 Nepal + 195 Bhutan) | MHA Annual Report 2024-25, via anantamias.com | SSB's own DG cited "734 sanctioned, 635 on ground" in 2017 — treat 734 as the sanctioned ceiling |
| SSB border length 2,450 km (1,751 Nepal + 699 Bhutan) | anantamias.com; corroborated by deccanchronicle.com | Consistent across sources |
| India's total land border 15,106.7 km | anantamias.com | — |
| BSF 5,500 cameras, ₹30 crore sanctioned | BSF DG Pankaj Kumar Singh, via Hindustan Times / Dhaka Tribune | BSF's front (Pakistan/Bangladesh), not SSB's — comparative context only |
| Punjab Police 2,291 cameras at 585 locations | newsarenaindia.com | Punjab's own initiative, not BSF or SSB |
| CIBMS ~71 km pilots (10 km Indo-Pak + 61 km Indo-Bangladesh) | PIB release (2019); Drishti IAS | — |
| CIBMS cost ≈₹10 crore/km | tribuneindia.com | — |
| ₹13,020 crore, 5-year Border Infrastructure & Management scheme (2021-26) | drishtiias.com | — |
| Panitanki has 13 CCTV cameras | obeta.ttef.in | Installed by local district police, not SSB directly |

## IBVAP's own cost estimates (not sourced — stated plainly)

| Component | Estimated cost (₹) |
|---|---|
| Edge AI compute node (ruggedised, GPU-capable, UPS-backed) | 1,80,000 |
| Installation & commissioning | 30,000 |
| Networking/mounting/integration | 40,000 |
| **Baseline total per BOP** | **2,50,000** |
| National rollout (734 BOPs × ₹2.5L + ₹2.7cr central platform) | ≈ ₹21 crore CAPEX |

## Software/model sources used in this build

| Component | Source | License |
|---|---|---|
| YOLOv8n weights | Ultralytics (auto-downloaded) | AGPL-3.0 |
| EasyOCR | JaidedAI | Apache 2.0 |
| ByteTrack (via `supervision`) | Roboflow | MIT |
| Test vehicle footage (`demo_assets/nissan_plate_test.mp4`) | "Sleek Black Nissan Skyline with License Plate" by Gaurav Kumar, Pexels | Pexels License (free, no attribution required) |
| UI components | shadcn/ui, ReactBits (reactbits.dev free tier), Aceternity UI (ui.aceternity.com free registry) | Various open/free-tier — see inline comments in each component file for exact provenance |

## Research literature referenced (not reproduced — cited)

- Pati, U.C. et al., "Video-based Real-time Intrusion Detection System using Deep-Learning for Smart City Applications," IEEE ANTS 2019 — near-identical pipeline (YOLO + SORT on Jetson TX2, 97% accuracy at 30 FPS) — direct precedent for this architecture on edge hardware
- Das, Pushpita, "Comprehensive Integrated Border Management System: Issues and Challenges," IDSA Issue Brief 2017 — policy critique supporting the cost argument for software-over-hardware
- Cardia et al., "Fusion of Heterogeneous Sensor Data in Border Surveillance," Sensors 2022 — multi-sensor fusion showing up to 50% accuracy improvement over single sensors
