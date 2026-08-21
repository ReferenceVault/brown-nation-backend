const FONT_STACK = "Georgia, 'Times New Roman', serif";

// Mirrors the brand tokens in frontend/src/app/globals.css
const COLORS = {
  cream: '#fbf3e7',
  card: '#ffffff',
  espresso: '#3a2317',
  espressoDark: '#2a190f',
  espressoMuted: 'rgba(58, 35, 23, 0.6)',
  brand500: '#d9822b',
  brand300: '#efaf68',
  brand50: '#fdf3e9',
  onDarkMuted: 'rgba(251, 243, 231, 0.7)',
  onDarkFaint: 'rgba(251, 243, 231, 0.45)',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:999px;background-color:${COLORS.brand500};">
      <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function renderEmailLayout(options: {
  frontendUrl: string;
  previewText: string;
  bodyHtml: string;
}): string {
  const { frontendUrl, previewText, bodyHtml } = options;
  const logoUrl = `${frontendUrl}/logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Brown Nation</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.cream};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${COLORS.card};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:${COLORS.espressoDark};padding:28px 32px;text-align:center;">
                <img src="${logoUrl}" width="48" height="48" alt="Brown Nation" style="display:inline-block;border-radius:50%;" />
                <div style="margin-top:10px;font-family:${FONT_STACK};font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.02em;">Brown Nation</div>
                <div style="margin-top:2px;font-family:${FONT_STACK};font-size:11px;letter-spacing:0.35em;color:${COLORS.brand300};font-weight:600;">— CHOCOLATES —</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;font-family:${FONT_STACK};color:${COLORS.espresso};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:${COLORS.espressoDark};padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;color:${COLORS.onDarkMuted};">brownnation.choco@gmail.com &nbsp;•&nbsp; +91 93580 23390</p>
                <p style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${COLORS.onDarkFaint};">This is an automated message from Brown Nation Chocolates.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const emailColors = COLORS;
export const emailFontStack = FONT_STACK;
