import type { Metadata } from 'next';
import { Container } from '@/components/store/container';
import { StatusPill, TokenNav, TOKEN_NOTICE } from '@/components/store/token-parts';
import { PROPOSED_ALLOCATION, PROPOSED_MAX_SUPPLY } from '@/lib/token';

export const metadata: Metadata = { title: 'Proposed tokenomics', description: 'The proposed supply and allocation of $PALLADIUM. Not final.', alternates: { canonical: '/pages/tokenomics' } };

const RULES = [
  'Fixed supply: no function exists to create more tokens after deployment.',
  'The whole supply is created once and sent to a multisignature treasury, not to a single person.',
  'Team and operations allocations follow vesting schedules published before any release.',
  'No staking yield, buy-backs or profit-sharing are planned. Any such feature would need explicit approval and legal review first.',
  'Supply and treasury movements will be reported on a public transparency page once the token is deployed.',
];

export default function TokenomicsPage() {
  const total = PROPOSED_ALLOCATION.reduce((s, a) => s + a.pct, 0);
  return (
    <Container className="py-12 sm:py-16">
      <TokenNav current="/pages/tokenomics" />
      <h1 className="h-display mt-10 text-4xl sm:text-6xl">Proposed tokenomics</h1>
      <p className="mt-4 max-w-2xl text-sm text-mute"><StatusPill tone="pending">Proposal, not final</StatusPill> <span className="ml-2">These figures are a plan. They become final only when the token contract is deployed and verified on-chain.</span></p>

      <p className="mt-8 font-display text-5xl tracking-tightest sm:text-6xl">{PROPOSED_MAX_SUPPLY.toLocaleString('en-PH')}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-mute">Proposed maximum supply of $PALLADIUM</p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-y border-line text-left text-sm">
          <caption className="sr-only">Proposed allocation of the maximum supply</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wider text-mute">
              <th scope="col" className="py-3 pr-4 font-semibold">Allocation</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">Share</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">Tokens</th>
              <th scope="col" className="py-3 font-semibold">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PROPOSED_ALLOCATION.map((a) => (
              <tr key={a.key}>
                <th scope="row" className="py-4 pr-4 font-semibold">{a.label}</th>
                <td className="py-4 pr-4 text-right tabular-nums">{a.pct}%</td>
                <td className="py-4 pr-4 text-right tabular-nums">{((PROPOSED_MAX_SUPPLY * a.pct) / 100).toLocaleString('en-PH')}</td>
                <td className="py-4 text-mute">{a.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink font-semibold">
              <th scope="row" className="py-3 pr-4">Total</th>
              <td className="py-3 pr-4 text-right tabular-nums">{total}%</td>
              <td className="py-3 pr-4 text-right tabular-nums">{PROPOSED_MAX_SUPPLY.toLocaleString('en-PH')}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="h-display mt-14 text-3xl">Principles</h2>
      <ul className="mt-5 max-w-3xl list-disc space-y-2 pl-5 text-sm text-mute">
        {RULES.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <p className="mt-12 max-w-3xl border-t border-line pt-6 text-xs text-mute">{TOKEN_NOTICE}</p>
    </Container>
  );
}
