import { discoverAccounts } from "./accounts";
import { sendDirectMessage, sendPrivateReply, sendPublicReply } from "./automation";
import { syncInstagramInbox } from "./inbox";
import { publishFacebookCarousel, publishFacebookPhoto } from "./publish-fb";
import { publishCarousel as publishIgCarousel, publishPhoto as publishIgPhoto } from "./publish-ig";
import { getInstagramInsights, getInstagramPermissions, listInstagramComments } from "./read";


/**
 * Unified interface for Meta APIs (Facebook, Instagram, Messenger).
 * Hides the underlying REST complexity and groups functionalities logically.
 */
export const MetaClient = {
  /** Account discovery and linking */
  accounts: {
    discover: discoverAccounts,
  },

  /** Content publishing across platforms */
  publish: {
    facebook: {
      photo: publishFacebookPhoto,
      carousel: publishFacebookCarousel,
    },
    instagram: {
      photo: publishIgPhoto,
      carousel: publishIgCarousel,
    },
  },

  /** Engagement and inbox management */
  engagement: {
    listComments: listInstagramComments,
    syncInbox: syncInstagramInbox,
    replyPublic: sendPublicReply,
    replyPrivate: sendPrivateReply,
    sendDirectMessage: sendDirectMessage,
  },

  /** Analytics and Insights */
  insights: {
    instagram: getInstagramInsights,
  },

  /** Access and Permissions */
  permissions: {
    instagram: getInstagramPermissions,
  },
};
