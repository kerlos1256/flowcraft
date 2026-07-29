import Link from 'next/link';
import { getInviteByToken } from '@/lib/workspace/data';
import { getSession } from '@/lib/auth';
import { appConfig } from '@/config/app.config';
import { InviteAccept } from '@/components/workspace/invite-accept';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const [invite, session] = await Promise.all([getInviteByToken(params.token), getSession()]);
  const next = `/invite/${params.token}`;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <span>{appConfig.logoGlyph}</span>
          {appConfig.name}
        </div>

        {!invite ? (
          <Message title="Invitation not found" body="This invitation link is invalid or has been removed." />
        ) : invite.status === 'accepted' ? (
          <Message title="Already accepted" body="This invitation has already been used." />
        ) : invite.status === 'revoked' ? (
          <Message title="Invitation revoked" body="This invitation is no longer valid." />
        ) : invite.status === 'expired' ? (
          <Message title="Invitation expired" body="This invitation has expired. Ask the workspace owner to send a new one." />
        ) : !session ? (
          <div>
            <Message
              title={`Join ${invite.workspaceName}`}
              body={`You've been invited to join the ${invite.workspaceName} workspace. Log in or create an account with ${invite.email} to accept.`}
            />
            <div className="mt-4 flex gap-2">
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary flex-1 justify-center">
                Log in
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn flex-1 justify-center">
                Sign up
              </Link>
            </div>
          </div>
        ) : session.email.toLowerCase() !== invite.email.toLowerCase() ? (
          <div>
            <Message
              title="Different account"
              body={`This invitation is for ${invite.email}, but you're signed in as ${session.email}.`}
            />
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn mt-4 w-full justify-center">
              Use a different account
            </Link>
          </div>
        ) : (
          <div>
            <Message title={`Join ${invite.workspaceName}`} body={`You've been invited to collaborate in ${invite.workspaceName}.`} />
            <InviteAccept token={params.token} defaultName={session.name} workspaceName={invite.workspaceName} />
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
