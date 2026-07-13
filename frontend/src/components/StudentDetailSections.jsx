import React from 'react';

const SECTIONS = [
  { id: 1, name: 'Personal Information', backendIds: [2, 3] },
  { id: 4, name: 'Indigenous Peoples (IP)', backendIds: [4] },
  { id: 5, name: 'Solo Parent & PWD', backendIds: [5] },
  { id: 6, name: 'Sports / Literary / Arts', backendIds: [6] },
  { id: 7, name: 'Internet & Digital Technology', backendIds: [7] },
];

const CATEGORY_ID_MAP = {};
SECTIONS.forEach(sec => {
  sec.backendIds.forEach(bid => { CATEGORY_ID_MAP[bid] = sec.id; });
});

export function groupAnswersBySection(questions, parsed) {
  const ipGroupQ = questions.find(qq => qq.system_key === 'indigenous_peoples_group');
  const ipGroupVal = ipGroupQ ? (parsed[ipGroupQ.id] ?? parsed[String(ipGroupQ.id)]) : null;

  const entries = Object.entries(parsed)
    .map(([qId, val]) => {
      const q = questions.find(qq => String(qq.id) === qId || qq.system_key === qId);
      return { qId, val, q, order: q?.display_order ?? 9999 };
    })
    .filter(({ q, val }) => {
      if (!q) return false;
      if (q.system_key === 'indigenous_peoples_other_specify' && ipGroupVal === 'Others') return false;
      if (q.field_type === 'textarea' && !val) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);

  const sectionMap = {};
  SECTIONS.forEach(sec => {
    sectionMap[sec.id] = { name: sec.name, entries: [] };
  });

  entries.forEach(entry => {
    const catId = entry.q?.category_id;
    const mappedId = CATEGORY_ID_MAP[catId] || 1;
    if (sectionMap[mappedId]) {
      sectionMap[mappedId].entries.push(entry);
    }
  });

  return Object.values(sectionMap).filter(s => s.entries.length > 0);
}

export function renderTableValue(val) {
  let rows;
  try { rows = typeof val === 'string' ? JSON.parse(val) : val; } catch { rows = null; }
  if (!Array.isArray(rows) || rows.length === 0) return <span className="text-sm text-muted-foreground italic">No entries</span>;
  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className="text-sm bg-muted/30 rounded-lg p-2.5 border border-border/40">
          {Object.entries(row).filter(([,v]) => v && String(v).trim()).map(([col, cv]) => (
            <div key={col} className="flex gap-2 py-0.5">
              <span className="font-medium text-muted-foreground shrink-0 min-w-[8rem]">{col}:</span>
              <span>{String(cv).toUpperCase()}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function StudentDetailSections({ questions, parsed, renderValue }) {
  const sections = groupAnswersBySection(questions, parsed);

  return (
    <div className="border-t pt-3 space-y-4">
      {sections.map((section, si) => (
        <div key={si}>
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">{section.name}</h4>
          <div className="space-y-2">
            {section.entries.map(({ qId, val, q }) => (
              <div key={qId} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-xs font-medium text-muted-foreground sm:w-1/2">{q.question_text}</span>
                {q.field_type === 'table'
                  ? renderTableValue(val)
                  : <span className="text-sm">{renderValue(qId, val, q)}</span>
                }
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
