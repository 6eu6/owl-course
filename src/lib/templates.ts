// Default Telegram post templates (shared by the formatter and settings).
// Lines whose placeholders are all empty are dropped at render time.

export const DEFAULT_TEMPLATES = {
  en:
    '\u{1F4DA} <b>{title}</b>\n\n' +
    '\u{1F464} <b>Instructor:</b> {instructor}\n' +
    '\u2B50 <b>Rating:</b> {rating}\n' +
    '\u{1F465} <b>Students:</b> {students_count}\n' +
    '\u{1F4B0} <b>Price:</b> {original_price} \u2192 Free\n' +
    '\u{1F30D} <b>Language:</b> {language}\n' +
    '\u23F1\uFE0F <b>Duration:</b> {duration}\n\n' +
    '\u2705 Free coupon \u2014 limited time\n' +
    '\u{1F517} {link}',
  ar:
    '\u{1F4DA} <b>{title}</b>\n\n' +
    '\u{1F464} <b>\u0627\u0644\u0645\u062F\u0631\u0628:</b> {instructor}\n' +
    '\u2B50 <b>\u0627\u0644\u062A\u0642\u064A\u064A\u0645:</b> {rating}\n' +
    '\u{1F465} <b>\u0627\u0644\u0637\u0644\u0627\u0628:</b> {students_count}\n' +
    '\u{1F4B0} <b>\u0627\u0644\u0633\u0639\u0631:</b> {original_price} \u2192 \u0645\u062C\u0627\u0646\u0627\u064B\n' +
    '\u{1F30D} <b>\u0627\u0644\u0644\u063A\u0629:</b> {language}\n' +
    '\u23F1\uFE0F <b>\u0627\u0644\u0645\u062F\u0629:</b> {duration}\n\n' +
    '\u2705 \u0643\u0648\u0628\u0648\u0646 \u0645\u062C\u0627\u0646\u064A \u2014 \u0644\u0641\u062A\u0631\u0629 \u0645\u062D\u062F\u0648\u062F\u0629\n' +
    '\u{1F517} {link}',
};
