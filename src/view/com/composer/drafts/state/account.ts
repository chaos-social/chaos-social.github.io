import {type Client} from '@atproto/lex'

import {
  useAppviewClient,
  useChatClient,
  useSession,
  useSessionApi,
} from '#/state/session'
import {pdsAgent} from '#/state/session/agent'
import {buildAppviewClient, buildChatClient} from '#/state/session/clients'

type DraftClients = {appviewClient: Client; chatClient: Client}

export function useDraftAccount(accountDid?: string) {
  const {accounts, currentAccount} = useSession()
  const appviewClient = useAppviewClient()
  const chatClient = useChatClient()
  const {createEphemeralAgent} = useSessionApi()
  const did = accountDid ?? currentAccount?.did

  async function runWithClients<Result>(
    run: (clients: DraftClients) => Promise<Result>,
  ): Promise<Result> {
    const account = accounts.find(candidate => candidate.did === did)
    if (!account) {
      throw new Error('The selected draft account is no longer signed in')
    }
    if (account.did === currentAccount?.did) {
      assertAccount({appviewClient, chatClient})
      return run({appviewClient, chatClient})
    }

    const ephemeral = await createEphemeralAgent(account)
    try {
      const agent = pdsAgent(ephemeral)
      const clients = {
        appviewClient: buildAppviewClient(agent),
        chatClient: buildChatClient(agent),
      }
      assertAccount(clients)
      return await run(clients)
    } finally {
      if ('dispose' in ephemeral && typeof ephemeral.dispose === 'function') {
        ;(ephemeral.dispose as () => void)()
      }
    }
  }

  function assertAccount(clients: DraftClients) {
    if (
      clients.appviewClient.assertDid !== did ||
      clients.chatClient.assertDid !== did
    ) {
      throw new Error('The draft session does not match the selected account')
    }
  }

  return {did, runWithClients}
}
