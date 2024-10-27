const { seedCompanies, seedCompaniesWithRateLimit } = require('./seed.hubspot')

async function runSeeder() {
  try {
    // For a small number of companies
    // const results = await seedCompanies(4)

    // OR for larger batches with rate limiting
    const results = await seedCompaniesWithRateLimit(150, 50, 1000)

    console.log('\n🚀 Seeding Summary:')
    console.log(`✅ Successfully added: ${results.successful}`)
    console.log(`❌ Failed: ${results.failed}`)

    if (results.failedCompanies.length > 0) {
      console.log('\nFailed Companies:')
      results.failedCompanies.forEach(company => {
        console.log(`- ${company.name}: ${company.error}`)
      })
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error.message)
  }
}

runSeeder()
