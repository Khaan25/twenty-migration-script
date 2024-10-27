const { faker } = require('@faker-js/faker')
const axios = require('axios')
require('dotenv').config()

const hubspotClient = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
})

// Generate a random company
function generateFakeCompany() {
  return {
    properties: {
      address: faker.location.streetAddress(),
      annualrevenue: faker.finance.amount(),
      city: faker.location.city(),
      country: faker.location.country(),
      description: faker.commerce.productDescription(),
      // industry: faker.commerce.department(),
      name: faker.company.name(),
      numberofemployees: faker.number.int({ min: 1, max: 1000 }),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      zip: faker.location.zipCode(),
    },
  }
}

// Add a single company to HubSpot
async function addCompanyToHubSpot(company) {
  try {
    const response = await hubspotClient.post('/crm/v3/objects/companies', company)
    return {
      success: true,
      data: response.data,
    }
  } catch (error) {
    return {
      success: false,
      error: error.response.data.message,
      company: company.properties.name,
    }
  }
}

// Add multiple companies to HubSpot
async function seedCompanies(count = 1) {
  console.log(`🚀 Starting to seed ${count} companies to HubSpot...`)

  const results = {
    successful: 0,
    failed: 0,
    failedCompanies: [],
  }

  for (let i = 0; i < count; i++) {
    const fakeCompany = generateFakeCompany()
    console.log('fakeCompany :', fakeCompany)
    const result = await addCompanyToHubSpot(fakeCompany)

    if (result.success) {
      results.successful++
      console.log(`✅ Added company (${i + 1}/${count}): ${fakeCompany.properties.name}`)
    } else {
      results.failed++
      results.failedCompanies.push({
        name: fakeCompany.properties.name,
        error: result.error,
      })
      console.log(`❌ Failed to add company (${i + 1}/${count}): ${fakeCompany.properties.name}`)
    }

    // Add a small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

// Optional: Rate limited version for bulk imports
async function seedCompaniesWithRateLimit(count = 1, batchSize = 10, delayMs = 1000) {
  console.log(`🚀 Starting to seed ${count} companies to HubSpot with rate limiting...`)

  const results = {
    successful: 0,
    failed: 0,
    failedCompanies: [],
  }

  for (let i = 0; i < count; i += batchSize) {
    const batchCount = Math.min(batchSize, count - i)
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}...`)

    const batchPromises = Array(batchCount)
      .fill(null)
      .map(async () => {
        const fakeCompany = generateFakeCompany()
        return addCompanyToHubSpot(fakeCompany)
      })

    const batchResults = await Promise.all(batchPromises)

    batchResults.forEach((result, index) => {
      if (result.success) {
        results.successful++
        console.log(`✅ Added company (${i + index + 1}/${count})`)
      } else {
        results.failed++
        results.failedCompanies.push({
          name: result.company,
          error: result.error,
        })
        console.log(`❌ Failed to add company (${i + index + 1}/${count})`)
      }
    })

    // Delay between batches
    if (i + batchSize < count) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

module.exports = {
  seedCompanies,
  seedCompaniesWithRateLimit,
  generateFakeCompany,
  addCompanyToHubSpot,
}
