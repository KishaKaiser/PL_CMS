import { PrivateMessageInbox } from '../../../components/private-message-inbox';

export default function ClientMessagesPage() {
  return (
    <PrivateMessageInbox
      title="Messages"
      description="Your inbox: write to Support and to advisors you have spoken with or booked a call with."
      backHref="/client"
    />
  );
}
