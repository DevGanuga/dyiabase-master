# Follow-up message for Kenneth → Marco

_Attach: `dyia-roadmap-response.pdf`_

---

Hey Marco,

Thanks again for the thorough roadmap review — the feedback was spot on and gave us a clear punch list. Quick update: we worked through all four items you raised, and they're all shipped. I put together a short PDF (attached) that walks through each one with before/afters and the reasoning.

The headlines:

- **Mobile expenses flow** — closing out the day on a phone now opens as a clean bottom sheet, so there's no scrolling to find the form or the save button. While we were in there we also fixed an underlying bug that was affecting *every* modal on mobile, so the whole app feels better on phones now.
- **"Free estimate" option** — gone. Scheduling is now just Scheduled Job or Estimate (estimates can still carry an optional price range, so nothing is lost). Existing records were migrated automatically.
- **Quotes beyond junk removal** — you were right that we were advertising lawn care and cleaning while the quote builder was hard-wired for junk. Business type is now a real setting, and the quote builder is trade-agnostic, so a cleaning or lawn-care operator can price the way they actually work. Deeper per-industry AI pricing is the next phase — it's outlined in the PDF.
- **Dyia Intel** — found and closed the real gaps: the monthly refresh wasn't actually scheduled in production, the full written report was being generated but not saved/shown, and basic-tier users hit a dead end. All fixed, plus the agent now uses verified Google data instead of re-guessing review counts.

Would love to grab 20 minutes this week to walk you through it live and talk through the quotes next-phase priorities. Does Thursday or Friday work?

Thanks,
Kenneth
