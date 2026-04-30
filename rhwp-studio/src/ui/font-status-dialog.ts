/**
 * 폰트 가용성 자세히 보기 다이얼로그
 */

import { ModalDialog } from './dialog';
import type { AvailabilityReport, FontStatus } from '@/core/font-availability-core';

class FontStatusDialog extends ModalDialog {
  constructor(private report: AvailabilityReport) {
    super('폰트 가용성', 520);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 18px';
    body.style.lineHeight = '1.5';
    body.style.fontSize = '13px';

    // 요약
    const summary = document.createElement('div');
    summary.style.marginBottom = '10px';
    const r = this.report;
    const ratioPct = Math.round(r.missingRatio * 100);
    summary.innerHTML = `
      <div>총 ${r.totalCount}종 — 가용 <b>${r.availableCount}</b>, 치환 <b>${r.substitutedCount}</b>, 누락 <b style="color:#c0392b">${r.missingCount}</b> (누락률 ${ratioPct}%)</div>
    `;
    body.appendChild(summary);

    // 표
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background:#f4f4f5; border-bottom:1px solid #d1d5db">
        <th style="text-align:left; padding:6px 8px; width: 45%">폰트명</th>
        <th style="text-align:left; padding:6px 8px; width: 18%">상태</th>
        <th style="text-align:left; padding:6px 8px">치환 결과</th>
      </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (r.perFont.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" style="padding:12px; text-align:center; color:#888">사용 폰트 정보 없음</td>`;
      tbody.appendChild(tr);
    } else {
      // 누락 → 치환 → OS → 번들 순으로 정렬
      const rank = (s: FontStatus): number => {
        switch (s.availability) {
          case 'missing': return 0;
          case 'substituted': return 1;
          case 'os': return 2;
          case 'registered': return 3;
        }
      };
      const sorted = [...r.perFont].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      for (const f of sorted) tbody.appendChild(this.row(f));
    }
    table.appendChild(tbody);
    body.appendChild(table);

    return body;
  }

  private row(f: FontStatus): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';

    const tdName = document.createElement('td');
    tdName.style.padding = '5px 8px';
    tdName.textContent = f.name;
    tr.appendChild(tdName);

    const tdStatus = document.createElement('td');
    tdStatus.style.padding = '5px 8px';
    const badge = document.createElement('span');
    badge.style.display = 'inline-block';
    badge.style.padding = '1px 8px';
    badge.style.borderRadius = '10px';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '500';
    switch (f.availability) {
      case 'registered':
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
        badge.textContent = '번들 OK';
        break;
      case 'os':
        badge.style.background = '#dbeafe';
        badge.style.color = '#1e40af';
        badge.textContent = '시스템 OK';
        break;
      case 'substituted':
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        badge.textContent = '치환됨';
        break;
      case 'missing':
        badge.style.background = '#fee2e2';
        badge.style.color = '#b91c1c';
        badge.textContent = '누락';
        break;
    }
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    const tdResolved = document.createElement('td');
    tdResolved.style.padding = '5px 8px';
    tdResolved.style.color = '#555';
    tdResolved.textContent = f.resolvedTo ?? '';
    tr.appendChild(tdResolved);

    return tr;
  }

  protected onConfirm(): void {
    this.hide();
  }
}

export function showFontStatusDialog(report: AvailabilityReport): void {
  new FontStatusDialog(report).show();
}
