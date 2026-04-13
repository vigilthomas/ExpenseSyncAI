"""
SMS Expense Parser
- Regex engine : extracts amount, currency, merchant, date, direction
- gemma:2b     : category classification only
- Validation   : prompts user to fill missing/ambiguous fields
"""

import json
import re
import httpx
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.prompt import Prompt
from rich.table import Table
from rich import box
from rich.text import Text
from rich.rule import Rule

console = Console()

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL      = "gemma:2b"

SAMPLE_SMS = [
    "INR 250.00 debited from A/c XX1234 on 12-Apr-25 at Zomato. Avl bal: INR 12,450.00",
    "You have spent Rs.89 on your SBI Card at UBER on 12-APR-2025.",
    "Received INR 5,000.00 from Rahul Kumar in your A/c XX5678. Ref: UPI/123456",
    "INR 1200 paid to Amazon India via UPI. UPI Ref: 503912874561",
    "Alert: INR 450.00 debited for electricity bill KSEB via BBPS on 11-Apr-2025",
    "Transaction successful: $200 debited from your account",   # ← missing merchant/date
]

CATEGORIES = ["Food", "Transport", "Shopping", "Utilities",
               "Entertainment", "Health", "Transfer", "Other"]

# ─── REGEX ENGINE ─────────────────────────────────────────────────────────────

CURRENCY_PATTERNS = [
    (r"\bINR\b",    "INR"),
    (r"\bRs\.?",    "INR"),
    (r"₹",          "INR"),
    (r"\bUSD\b|\$", "USD"),
    (r"\bGBP\b|£",  "GBP"),
    (r"\bEUR\b|€",  "EUR"),
    (r"\bAED\b",    "AED"),
]

AMOUNT_PATTERN = re.compile(
    r"(?:INR|Rs\.?|₹|\$|USD|£|€|AED)\s*([\d,]+(?:\.\d{1,2})?)"
    r"|"
    r"([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?|₹|\$|USD|£|€|AED)",
    re.IGNORECASE,
)

DATE_PATTERNS = [
    (r"\b\d{2}-[A-Za-z]{3}-\d{2}\b",   "%d-%b-%y"),
    (r"\b\d{2}-[A-Za-z]{3}-\d{4}\b",   "%d-%b-%Y"),
    (r"\b\d{2}/\d{2}/\d{4}\b",         "%d/%m/%Y"),
    (r"\b\d{4}-\d{2}-\d{2}\b",         "%Y-%m-%d"),
    (r"\b\d{2}/\d{2}\b",               "%m/%d"),
]

DEBIT_KEYWORDS  = re.compile(r"\b(debited?|spent|paid|payment|purchase|debit|withdraw|deducted|charged)\b", re.I)
CREDIT_KEYWORDS = re.compile(r"\b(credited?|received|refund|cashback|credit|reversed)\b", re.I)

MERCHANT_PATTERNS = [
    r"\bat\s+([A-Z][A-Za-z0-9\s&\-]{1,30}?)(?:\s+on|\s+via|\s*[.,]|$)",
    r"\bto\s+([A-Z][A-Za-z0-9\s&\-]{1,30}?)(?:\s+via|\s*[.,]|$)",
    r"\bfor\s+(?:electricity bill|bill)\s+([A-Z][A-Za-z0-9]{2,15})\b",
    # r"\bfrom\s+..." — disabled: too greedy on "from your account"
    r"\b(Zomato|Swiggy|Amazon|Flipkart|UBER|Ola|KSEB|Netflix|Spotify"
    r"|BigBasket|Blinkit|Zepto|PhonePe|GPay|Paytm|BBPS|Myntra|Nykaa"
    r"|Dunzo|Rapido|MakeMyTrip|BookMyShow|Airtel|Jio|BSNL)\b",
]

SKIP_MERCHANTS = {"your", "the", "a", "an", "my", "this", "that", "account", "card", "your account"}


def detect_currency(text: str) -> str:
    for pattern, code in CURRENCY_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return code
    return "INR"


def extract_amount(text: str, currency: str) -> int | None:
    # Ignore balance amounts (after "bal", "balance", "avl")
    clean = re.sub(r"(?:avl\s*bal|balance|bal)\s*:?\s*[\$₹]?[\d,]+(?:\.\d{1,2})?", "", text, flags=re.I)
    match = AMOUNT_PATTERN.search(clean)
    if not match:
        return None
    raw = (match.group(1) or match.group(2)).replace(",", "")
    return int(round(float(raw) * 100))


def extract_date(text: str) -> str | None:
    for pattern, fmt in DATE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                date_str = m.group(0)
                if fmt == "%m/%d":
                    dt = datetime.strptime(f"{date_str}/{datetime.now().year}", "%m/%d/%Y")
                else:
                    dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%dT00:00:00")
            except ValueError:
                continue
    return None


def extract_merchant(text: str) -> str | None:
    for pattern in MERCHANT_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            merchant = m.group(1).strip().rstrip(".,")
            if merchant.lower() not in SKIP_MERCHANTS:
                return merchant
    return None


def detect_direction(text: str) -> bool:
    """True = debit (money out)."""
    has_debit  = bool(DEBIT_KEYWORDS.search(text))
    has_credit = bool(CREDIT_KEYWORDS.search(text))
    if has_credit and not has_debit:
        return False
    return True


# ─── GEMMA:2B CATEGORY CLASSIFIER ─────────────────────────────────────────────

CATEGORY_PROMPT = """Reply with ONE word only — pick from:
Food, Transport, Shopping, Utilities, Entertainment, Health, Transfer, Other

Transaction: {desc}
Category:"""

KEYWORD_CATEGORY = [
    (["zomato","swiggy","restaurant","food","eat","cafe","hotel","pizza","burger"],    "Food"),
    (["uber","ola","petrol","fuel","metro","bus","cab","rapido","transport","toll"],   "Transport"),
    (["amazon","flipkart","shop","mall","store","myntra","nykaa","meesho"],            "Shopping"),
    (["electric","kseb","water","gas","bill","bbps","recharge","airtel","jio"],        "Utilities"),
    (["netflix","spotify","movie","prime","hotstar","bookmyshow","entertainment"],     "Entertainment"),
    (["hospital","doctor","pharmacy","medical","health","apollo","clinic"],            "Health"),
    (["transfer","neft","upi","imps","sent","received","wallet","razorpay"],           "Transfer"),
]


def classify_category(merchant: str | None, sms: str) -> str:
    desc = merchant or sms[:80]

    # Keyword first (fast, reliable)
    text_lower = (desc + " " + sms).lower()
    for keywords, cat in KEYWORD_CATEGORY:
        if any(w in text_lower for w in keywords):
            return cat

    # gemma:2b as fallback
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(OLLAMA_URL, json={
                "model": MODEL,
                "prompt": CATEGORY_PROMPT.format(desc=desc),
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 10, "stop": ["\n", ".", ","]},
            })
            resp.raise_for_status()
            word = resp.json()["response"].strip().split()[0].capitalize()
            if word in CATEGORIES:
                return word
    except Exception:
        pass

    return "Other"


# ─── VALIDATION ───────────────────────────────────────────────────────────────

def get_missing_fields(result: dict) -> list[str]:
    """Return list of field names that are missing or need confirmation."""
    missing = []
    if not result.get("merchant"):
        missing.append("merchant")
    if not result.get("date_time"):
        missing.append("date_time")
    if result.get("category") == "Other":
        missing.append("category")
    return missing


def prompt_missing_fields(result: dict, sms_text: str) -> dict:
    """
    Show parsed result so far, highlight missing fields,
    and interactively ask user to fill them in.
    """
    missing = get_missing_fields(result)
    if not missing:
        return result

    console.print()
    console.print(Panel(
        f"[yellow]Some fields couldn't be auto-detected from:[/]\n[dim]{sms_text}[/]",
        title="[bold yellow]⚠ Incomplete Parse",
        border_style="yellow",
    ))

    # Show what was detected
    console.print("[dim]Detected so far:[/]")
    currency = result.get("currency", "INR")
    amt = result.get("amount_minor", 0) / 100
    direction = "[red]Debit[/]" if result.get("is_debit") else "[green]Credit[/]"
    console.print(f"  Amount   : {currency} {amt:,.2f}  ({direction})")
    console.print(f"  Merchant : [yellow]{result.get('merchant') or '—  ← missing'}[/]")
    console.print(f"  Date     : [yellow]{result.get('date_time') or '—  ← missing'}[/]")
    console.print(f"  Category : [yellow]{result.get('category')}{'  ← unconfident' if result.get('category') == 'Other' else ''}[/]")
    console.print()

    # Merchant
    if "merchant" in missing:
        val = Prompt.ask(
            "[bold cyan]  Merchant name[/] [dim](e.g. Zomato, KSEB — or press Enter to skip)[/]",
            default=""
        ).strip()
        if val:
            result["merchant"] = val
            # re-classify with the merchant hint
            result["category"] = classify_category(val, sms_text)
            result["description"] = f"{val} {'debit' if result['is_debit'] else 'credit'}"

    # Date
    if "date_time" in missing:
        val = Prompt.ask(
            "[bold cyan]  Date[/] [dim](DD-Mon-YYYY or YYYY-MM-DD — or press Enter for today)[/]",
            default=""
        ).strip()
        if val:
            parsed_dt = extract_date(val)
            if parsed_dt:
                result["date_time"] = parsed_dt
            else:
                # try simple ISO
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d")
                    result["date_time"] = dt.strftime("%Y-%m-%dT00:00:00")
                except ValueError:
                    console.print("  [dim]Could not parse date — leaving as today.[/]")
                    result["date_time"] = datetime.now().strftime("%Y-%m-%dT00:00:00")
        else:
            result["date_time"] = datetime.now().strftime("%Y-%m-%dT00:00:00")

    # Category (only if still Other after merchant hint)
    if "category" in missing and result.get("category") == "Other":
        cats_display = " / ".join(CATEGORIES)
        val = Prompt.ask(
            f"[bold cyan]  Category[/] [dim]({cats_display})[/]",
            default="Other"
        ).strip().capitalize()
        if val in CATEGORIES:
            result["category"] = val

    # Recalculate confidence
    fields_found = sum([
        result.get("amount_minor") is not None,
        result.get("date_time") is not None,
        result.get("merchant") is not None,
        result.get("category") != "Other",
    ])
    result["raw_confidence"] = round(0.6 + (fields_found / 4) * 0.4, 2)
    result["_manually_completed"] = True

    console.print("[green]  ✓ Fields updated.[/]")
    return result


# ─── MAIN PARSER ──────────────────────────────────────────────────────────────

def parse_sms(sms_text: str, interactive: bool = True) -> dict:
    currency     = detect_currency(sms_text)
    amount_minor = extract_amount(sms_text, currency)
    date_time    = extract_date(sms_text)
    merchant     = extract_merchant(sms_text)
    is_debit     = detect_direction(sms_text)

    if amount_minor is None:
        return {"error": "Could not extract amount from SMS", "_raw_sms": sms_text}

    category = classify_category(merchant, sms_text)

    fields_found = sum([True, date_time is not None, merchant is not None, category != "Other"])
    confidence   = round(0.6 + (fields_found / 4) * 0.4, 2)

    result = {
        "amount_minor": amount_minor,
        "currency":     currency,
        "category":     category,
        "description":  f"{merchant or 'Transaction'} {'debit' if is_debit else 'credit'}",
        "merchant":     merchant,
        "date_time":    date_time,
        "source":       "sms",
        "is_debit":     is_debit,
        "raw_confidence": confidence,
        "_raw_sms":     sms_text,
        "_parsed_at":   datetime.now().isoformat(),
    }

    # Validation: ask for missing fields interactively
    if interactive and get_missing_fields(result):
        result = prompt_missing_fields(result, sms_text)

    return result


# ─── DISPLAY ──────────────────────────────────────────────────────────────────

def display_result(result: dict):
    if "error" in result:
        console.print(f"\n[bold red]ERR:[/] {result['error']}")
        return

    table = Table(box=box.ROUNDED, show_header=False, border_style="cyan")
    table.add_column("Field", style="bold cyan", width=18)
    table.add_column("Value", style="white")

    amount_major = result.get("amount_minor", 0) / 100
    currency     = result.get("currency", "INR")
    direction    = "[red]Debit[/]" if result.get("is_debit") else "[green]Credit[/]"
    confidence   = result.get("raw_confidence", 0)
    conf_bar     = "█" * int(confidence * 10) + "░" * (10 - int(confidence * 10))
    manual_tag   = " [dim](manually completed)[/]" if result.get("_manually_completed") else ""

    table.add_row("Direction",  direction)
    table.add_row("Amount",     f"{currency} {amount_major:,.2f}")
    table.add_row("Category",   result.get("category", "-"))
    table.add_row("Merchant",   result.get("merchant") or "-")
    table.add_row("Date/Time",  result.get("date_time") or "-")
    table.add_row("Confidence", f"{conf_bar} {confidence:.0%}{manual_tag}")

    console.print()
    console.print(table)
    clean = {k: v for k, v in result.items() if not k.startswith("_")}
    console.print(Panel(
        Syntax(json.dumps(clean, indent=2), "json", theme="monokai"),
        title="[bold]Full JSON Output",
        border_style="dim",
    ))


def print_batch_summary(results: list[dict]):
    """Print a summary table after batch parse."""
    console.print()
    console.print(Rule("[bold]Batch Summary"))

    ok      = [r for r in results if "error" not in r]
    errors  = [r for r in results if "error" in r]
    debits  = [r for r in ok if r.get("is_debit")]
    credits = [r for r in ok if not r.get("is_debit")]

    total_debit  = sum(r.get("amount_minor", 0) for r in debits)
    total_credit = sum(r.get("amount_minor", 0) for r in credits)

    t = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
    t.add_column("",         width=14)
    t.add_column("Count",    justify="right", width=8)
    t.add_column("Amount",   justify="right", width=14)

    t.add_row("Parsed OK",   str(len(ok)),      "")
    t.add_row("Errors",      str(len(errors)),   "")
    t.add_row("Total Debit", str(len(debits)),  f"INR {total_debit/100:,.2f}")
    t.add_row("Total Credit",str(len(credits)), f"INR {total_credit/100:,.2f}")

    console.print(t)

    # Category breakdown
    if ok:
        cats: dict[str, int] = {}
        for r in ok:
            c = r.get("category", "Other")
            cats[c] = cats.get(c, 0) + 1
        cat_str = "  ".join(f"[cyan]{k}[/]:{v}" for k, v in sorted(cats.items(), key=lambda x: -x[1]))
        console.print(f"[dim]Categories:[/] {cat_str}")


def run_batch(sms_list: list[str], interactive: bool = True) -> list[dict]:
    console.print(f"\n[bold]Parsing {len(sms_list)} messages...[/]\n")
    results = []
    for i, sms in enumerate(sms_list, 1):
        console.print(f"[dim]({i}/{len(sms_list)})[/] {sms[:65]}...")
        result = parse_sms(sms, interactive=interactive)
        results.append(result)
        if "error" not in result:
            amt       = f"{result['currency']} {result['amount_minor']/100:,.2f}"
            merchant  = result.get("merchant") or "-"
            cat       = result.get("category", "-")
            direction = "DR" if result.get("is_debit") else "CR"
            manual    = " [dim]*[/]" if result.get("_manually_completed") else ""
            console.print(f"  [green]OK[/]  {direction}  {amt:>12}  {merchant:<20} [{cat}]{manual}")
        else:
            console.print(f"  [red]ERR[/] {result['error']}")

    print_batch_summary(results)

    output_file = f"parsed_expenses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    console.print(f"\n[green]Saved -> {output_file}[/]")
    return results


# ─── CLI ──────────────────────────────────────────────────────────────────────

def run_interactive():
    console.print(Panel.fit(
        "[bold cyan]SMS Expense Parser[/]\n"
        "[dim]Regex engine + gemma:2b · with validation[/]",
        border_style="cyan",
    ))

    while True:
        console.print("\n[bold]Options:[/]")
        console.print("  [cyan]1[/] - Parse single SMS")
        console.print("  [cyan]2[/] - Run sample SMS")
        console.print("  [cyan]3[/] - Batch parse your own SMS list")
        console.print("  [cyan]4[/] - Batch parse samples (no prompts)")
        console.print("  [cyan]q[/] - Quit")
        choice = Prompt.ask("\n[bold cyan]Choice", default="1")

        if choice == "q":
            console.print("[dim]Bye![/]")
            break

        elif choice == "1":
            sms = Prompt.ask("\n[bold]Paste SMS text")
            if sms.strip():
                console.print("\n[dim]Parsing...[/]")
                result = parse_sms(sms.strip(), interactive=True)
                display_result(result)

        elif choice == "2":
            console.print("\n[bold]Sample SMS messages:[/]")
            for i, s in enumerate(SAMPLE_SMS, 1):
                console.print(f"  [cyan]{i}[/] - {s[:72]}")
            idx = Prompt.ask("Pick one", default="1")
            try:
                sms = SAMPLE_SMS[int(idx) - 1]
                console.print(f"\n[dim]SMS:[/] {sms}\n[dim]Parsing...[/]")
                result = parse_sms(sms, interactive=True)
                display_result(result)
            except (IndexError, ValueError):
                console.print("[red]Invalid choice[/]")

        elif choice == "3":
            console.print("\n[bold]Enter SMS messages one by one.[/]")
            console.print("[dim]Press Enter on a blank line when done.[/]\n")
            sms_list = []
            while True:
                entry = Prompt.ask(
                    f"[cyan]SMS {len(sms_list)+1}[/] [dim](blank to finish)[/]",
                    default=""
                )
                if not entry.strip():
                    break
                sms_list.append(entry.strip())

            if not sms_list:
                console.print("[yellow]No SMS entered.[/]")
            else:
                run_batch(sms_list, interactive=True)

        elif choice == "4":
            run_batch(SAMPLE_SMS, interactive=False)


if __name__ == "__main__":
    run_interactive()
