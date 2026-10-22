"""BookLeaf's knowledge base (from the assignment brief), split by ticket category.

Why split it: a draft for an ISBN ticket only needs the ISBN policy, not the royalty
or printing policy. Sending one section instead of the whole knowledge base keeps
each prompt small (cheaper, faster) and keeps the model focused on the right policy.
"""
from app.models import TicketCategory as Cat

COMPANY = """\
BookLeaf Publishing is a self-publishing company operating in India and the US.
Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books."""

TONE = """\
- Empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before giving solutions.
- Be specific: use the actual numbers, dates and statuses given to you, not vague reassurances.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline (e.g. "within 48 hours"), not open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team."""

POLICIES: dict[Cat, str] = {
    Cat.ROYALTY: """\
Royalty policy:
- 80/20 split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: Rs 1,000. Below that, royalties roll over to the next quarter.
- Payouts are by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown (sales per platform) in their dashboard.""",
    Cat.ISBN_METADATA: """\
ISBN policy:
- Every book published through BookLeaf gets a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. An author who wants an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.
Metadata: updates (e.g. book description) can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect on platforms within 3-5 business days.""",
    Cat.PRINTING_QUALITY: """\
Printing & quality:
- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency) BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.""",
    Cat.DISTRIBUTION: """\
Distribution & availability:
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7-10 business days after publication is complete.
- A book showing as unavailable on a platform usually means a stock sync issue; BookLeaf can trigger a re-sync within 24-48 hours.""",
    Cat.BOOK_STATUS: """\
Production stages, in order: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are updated by email at each stage.
- Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).""",
    Cat.GENERAL: """\
General:
- Metadata updates (e.g. book description) can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect within 3-5 business days.
- For anything that needs checking by the team, give a 48-hour timeline.""",
}

# Sample query -> expected handling, from the brief. Used as calibration in the draft prompt.
EXAMPLES: dict[Cat, list[tuple[str, str]]] = {
    Cat.ROYALTY: [
        (
            "I published my book 4 months ago and still haven't received any royalty. What's going on?",
            "Acknowledge the frustration. Explain the quarterly cycle and 45-day payout window. Check bank details are linked. "
            "Give the specific next payout date. If the payment is genuinely overdue, escalate with a 48-hour resolution timeline.",
        ),
        (
            "My royalty amount seems too low. I sold 200 copies but only received Rs 3,000.",
            "Explain net profit: MRP minus printing, platform commission and shipping. Offer a detailed line-by-line breakdown. "
            "Don't be defensive; offer transparency.",
        ),
    ],
    Cat.ISBN_METADATA: [
        (
            "My book is showing a different ISBN on Amazon than what's on the physical copy.",
            "Treat as high priority; acknowledge it's a serious data issue. Confirm escalation to the production team now, "
            "with a 48-hour resolution timeline.",
        ),
    ],
    Cat.PRINTING_QUALITY: [
        (
            "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
            "Apologise sincerely. Ask for photos of the defective copies. Confirm a free reprint once verified, "
            "with a 5-7 business day timeline for the reprint.",
        ),
    ],
    Cat.DISTRIBUTION: [
        (
            "My book is published but it's showing as 'Currently Unavailable' on Amazon.",
            "Explain it's typically a stock sync issue. Confirm you're triggering a re-sync with the distribution team. "
            "Set expectation: 24-48 hours for it to go live again.",
        ),
    ],
    Cat.BOOK_STATUS: [
        (
            "It's been 3 weeks and my book is still in typesetting. When will it be done?",
            "Check the actual production status. If delayed, be honest about why (e.g. waiting on proof approval). "
            "Give a specific updated timeline. Don't blame the author; frame it collaboratively.",
        ),
    ],
    Cat.GENERAL: [
        (
            "Can I update the description of my book on Amazon after it's already live?",
            "Yes: submit through the dashboard or email the BookLeaf team. Changes typically reflect within 3-5 business days.",
        ),
    ],
}


def section_for(category: Cat) -> str:
    """The policy text and calibration examples for one category."""
    examples = "\n".join(f'- Query: "{q}"\n  How to handle: {how}' for q, how in EXAMPLES[category])
    return f"{POLICIES[category]}\n\nExamples of how BookLeaf handles this kind of query:\n{examples}"
