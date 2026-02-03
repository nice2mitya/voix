const VOXIMPLANT_BASE_URL = 'https://api.voximplant.com/platform_api'

interface StartScenariosParams {
  ruleId: string
  customData: string
}

export async function startScenarios({ ruleId, customData }: StartScenariosParams) {
  const accountId = process.env.VOXIMPLANT_ACCOUNT_ID
  const apiKey = process.env.VOXIMPLANT_API_KEY

  if (!accountId || !apiKey) {
    throw new Error('Voximplant credentials not configured')
  }

  const params = new URLSearchParams()
  params.append('account_id', accountId)
  params.append('api_key', apiKey)
  params.append('rule_id', ruleId)
  params.append('script_custom_data', customData)

  const response = await fetch(`${VOXIMPLANT_BASE_URL}/StartScenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Voximplant API error: ${text}`)
  }

  return response.json()
}

export async function getCallHistory() {
  const accountId = process.env.VOXIMPLANT_ACCOUNT_ID
  const apiKey = process.env.VOXIMPLANT_API_KEY

  if (!accountId || !apiKey) {
    throw new Error('Voximplant credentials not configured')
  }

  const response = await fetch(
    `${VOXIMPLANT_BASE_URL}/GetCallHistory?account_id=${accountId}&api_key=${apiKey}&from_date=${encodeURIComponent(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())}&to_date=${encodeURIComponent(new Date().toISOString())}&count=100`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Voximplant API error: ${text}`)
  }

  return response.json()
}
