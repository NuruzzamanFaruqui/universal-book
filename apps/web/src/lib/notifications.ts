export function notificationHref(n: { type: string; linkId?: string | null }) {
  switch (n.type) {
    case 'POST_LIKE':
    case 'POST_COMMENT':
    case 'POST_REPOST':
      return '/feed'; // no single-post page exists yet
    case 'CONNECTION_REQUEST':
    case 'CONNECTION_ACCEPTED':
    case 'NEW_FOLLOWER':
      return n.linkId ? `/profile/${n.linkId}` : '/notifications';
    case 'DIRECT_MESSAGE':
      return n.linkId ? `/messages/${n.linkId}` : '/messages';
    case 'BOOK_COLLAB_INVITE':
      return n.linkId ? `/dashboard/books/${n.linkId}/edit` : '/feed?tab=mine';
    default:
      return '/notifications';
  }
}