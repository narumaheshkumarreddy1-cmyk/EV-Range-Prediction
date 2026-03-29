# Responsive Display Size Fixes - Approved Plan
Status: 🚀 In Progress

## Breakdown (Sequential Steps):

### ✅ Step 1: Create/Update TODO.md [DONE]
Track progress here.

### ⏳ Step 2: Fix dashboard_gauges.css (Gauges/Pedals Responsive)
- Replace fixed 320px canvas with `min(90vw, 320px)`
- Scale pedals/icons for mobile
- Add mobile media queries

### ⏳ Step 3: Fix dashboard.css (Sidebar/Layout Responsive)  
- Sidebar: `width: min(240px, 80vw)` or mobile menu
- Main: conditional margin-left
- Mobile-first grid adjustments

### ⏳ Step 4: Update map.js (Dynamic Icon/Map Sizing)
- Icons: `Math.min(28, window.innerWidth * 0.06)`
- Map container: full viewport
- Resize listener

### ⏳ Step 5: Update dashboard.html (Minor Layout)
- Responsive canvas HTML attributes
- Mobile-friendly simulation container

### ⏳ Step 6: Test & Verify
```
# Backend running? Check terminals first
cd backend && python run.py
# Browser test
start http://localhost:5000/dashboard
```
- F12 → Responsive mode (iPhone, iPad)
- Verify no overlaps/overflows

### ⏳ Step 7: Final Cleanup & Complete
- Update TODO.md ✅
- attempt_completion
