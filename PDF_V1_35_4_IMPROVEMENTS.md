# Leo Bot v1.35.4 — PDF Improvements

## Multi-image PDF
Use `.pdf متعدد` with the first image, send additional images normally, then send `تم`. Up to 20 images are combined in order.

## PDF analysis
Document analysis now uses bounded multi-pass chunks, avoiding oversized URL requests to public AI fallbacks. If all AI providers fail, Leo returns a deterministic extraction report instead of a generic apology.

## PDF translation
Translation uses smaller requests, Google Translate first, MyMemory fallback, RTL shaping for Arabic, and preserves the original page visual as a background. A failed segment no longer aborts the whole document.

## PDF to Word
Each original page is preserved visually at the correct proportions. A selectable extracted-text appendix is included after the visual pages.

## PDF to Excel
PyMuPDF table detection is preferred. Each page gets its own worksheet, with an `Extracted Text` sheet as a reliable fallback.

## PDF to PowerPoint
Slide dimensions now follow the PDF aspect ratio and each page is fitted without stretching.
