import {createContext, useContext} from 'react'

const DeckColumnContext = createContext(false)

/** Marks a feed rendered as one column of the deck, rather than a pager page. */
export function DeckColumnProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <DeckColumnContext value={true}>{children}</DeckColumnContext>
}

export function useIsInDeckColumn() {
  return useContext(DeckColumnContext)
}
