import {type BskyAgent, type Facet, type RichText} from '@atproto/api'
import {tokenize} from '@easrng/tr58'

const TAG_CHARS = ['#', '＃', '$']

export interface FacetRun {
  text: string
  features: Facet['features']
}

export function detectFacetRunsWithoutResolution(text: string): FacetRun[] {
  const facetRuns: FacetRun[] = []

  const tokens = tokenize(text, {
    nonStandard: {domainHandle: true, tags: TAG_CHARS},
  })

  for (const token of tokens) {
    if (token.type === 'URL') {
      const val = token.value

      // Handle mentions (@handle.com)
      if (/^[@＠]/.test(token.value)) {
        facetRuns.push({
          text: val,
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: val.slice(1) as any,
            },
          ],
        })
      }
      // Handle tags (#tag or $cashtag)
      else if (TAG_CHARS.some(char => val.startsWith(char))) {
        const normalized = (val[0] === '$' ? val : val.slice(1)).normalize(
          'NFKC',
        )
        facetRuns.push({
          text: val,
          features: /^\$?\d/.test(normalized)
            ? []
            : [
                {
                  $type: 'app.bsky.richtext.facet#tag',
                  tag: normalized,
                },
              ],
        })
      } else {
        let uri = val
        if (!/^[a-z][a-z0-9+.-]*:\/\//.test(uri)) {
          uri = `https://${uri}`
        }
        const NON_EMAIL = /^[^@＠]+?([?/#:]|$)/
        facetRuns.push({
          text: val,
          // don't link email addresses
          features: NON_EMAIL.test(token.value)
            ? [
                {
                  $type: 'app.bsky.richtext.facet#link',
                  uri: uri,
                },
              ]
            : [],
        })
      }
    } else {
      facetRuns.push({
        text: token.value,
        features: [],
      })
    }
  }
  return facetRuns
}

export function detectFacetsWithoutResolution(rt: RichText) {
  const facets: Facet[] = []

  let currentByteOffset = 0

  for (const run of detectFacetRunsWithoutResolution(rt.text)) {
    const runBytes = new TextEncoder().encode(run.text)
    const start = currentByteOffset
    const end = start + runBytes.byteLength

    if (run.features.length) {
      facets.push({
        index: {byteStart: start, byteEnd: end},
        features: run.features,
      })
    }

    currentByteOffset = end
  }

  rt.facets = facets
  return rt
}

export async function detectFacets(agent: BskyAgent, rt: RichText) {
  detectFacetsWithoutResolution(rt)
  if (rt.facets) {
    for (const facet of rt.facets) {
      for (const feature of facet.features) {
        if (
          feature.$type === 'app.bsky.richtext.facet#mention' &&
          'did' in feature &&
          !feature.did.startsWith('did:')
        ) {
          try {
            const res = await agent.resolveHandle({handle: feature.did})
            feature.did = res.data.did
          } catch (e) {
            facet.features = facet.features.filter(f => f !== feature)
          }
        }
      }
    }
  }

  return rt
}
