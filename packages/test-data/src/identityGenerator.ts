// Test identity generator for Phase 19
import type { TestIdentity, IdentityGeneratorOptions } from './types.js';

// Sample data for realistic test identity generation
const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Donald', 'Sandra', 'Mark', 'Ashley',
  'Paul', 'Dorothy', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
  'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
  'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen', 'Stephen', 'Anna',
  'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Frank', 'Debra',
  'Alexander', 'Rachel', 'Raymond', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Ruth',
  'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane', 'Aaron', 'Virginia',
  'Jose', 'Julie', 'Adam', 'Joyce', 'Henry', 'Victoria', 'Nathan', 'Olivia',
  'Douglas', 'Kelly', 'Zachary', 'Christina', 'Peter', 'Lauren', 'Kyle', 'Joan',
  'Walter', 'Evelyn', 'Ethan', 'Judith', 'Jeremy', 'Megan', 'Harold', 'Cheryl',
  'Keith', 'Andrea', 'Christian', 'Hannah', 'Roger', 'Martha', 'Noah', 'Jacqueline'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
  'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales',
  'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson',
  'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward',
  'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
  'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
  'Sullivan', 'Bell', 'Coleman', 'Butler', 'Barnes', 'Fisher', 'Henderson', 'Cole',
  'Simmons', 'Patterson', 'Alexander', 'Washington', 'Griffin', 'Thompson', 'Sanchez',
  'West', 'Rose', 'Hansen', 'Gibson', 'Ellis', 'Ford', 'Dixon', 'Castaneda'
];

const cities = [
  'Springfield', 'Franklin', 'Greenville', 'Bristol', 'Clinton', 'Fairview', 'Georgetown',
  'Salem', 'Madison', 'Washington', 'Auburn', 'Lexington', 'Manchester', 'Oakland',
  'Taylor', 'Hudson', 'Marlborough', 'Milton', 'Plymouth', 'Quincy', 'Randolph',
  'Weymouth', 'Worcester', 'Cambridge', 'Brookline', 'Newton', 'Somerville', 'Malden'
];

const states = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'TX', name: 'Texas' },
  { code: 'NY', name: 'New York' },
  { code: 'MA', name: 'Massachusetts' }
];

export class IdentityGenerator {
  private rng: () => number;

  constructor(seed?: string) {
    // Simple seeded random number generator for deterministic results
    if (seed) {
      let seedNum = this.hashString(seed);
      this.rng = () => {
        seedNum = (seedNum * 9301 + 49297) % 233280;
        return seedNum / 233280;
      };
    } else {
      this.rng = Math.random;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomItem<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  private generateEmail(firstName: string, lastName: string, runExecutionId: number): string {
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];
    const domain = this.randomItem(domains);
    const separator = this.randomItem(['.', '_', '-', '']);
    const timestamp = Date.now();
    const random = this.randomInt(1000, 9999);

    // Generate email with run execution ID for uniqueness
    return `${firstName.toLowerCase()}${separator}${lastName.toLowerCase()}.${runExecutionId}.${random}@${domain}`;
  }

  private generateUsername(firstName: string, lastName: string, runExecutionId: number): string {
    const timestamp = Date.now();
    const random = this.randomInt(100, 999);
    return `${firstName.toLowerCase()}${lastName.toLowerCase()}${runExecutionId}${random}`;
  }

  private generatePhoneNumber(): string {
    const areaCode = this.randomInt(200, 999);
    const exchange = this.randomInt(200, 999);
    const number = this.randomInt(1000, 9999);
    return `(${areaCode}) ${exchange}-${number}`;
  }

  private generateDateOfBirth(minAge: number = 18, maxAge: number = 80): Date {
    const now = new Date();
    const year = now.getFullYear() - this.randomInt(minAge, maxAge);
    const month = this.randomInt(0, 11);
    const day = this.randomInt(1, 28);
    return new Date(year, month, day);
  }

  private generateAddress(): {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    stateCode: string;
    postalCode: string;
  } {
    const streetNumber = this.randomInt(1, 9999);
    const streetNames = ['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Washington', 'Lake', 'Hill'];
    const streetTypes = ['St', 'Ave', 'Blvd', 'Rd', 'Ln', 'Dr'];
    const streetName = this.randomItem(streetNames);
    const streetType = this.randomItem(streetTypes);
    const city = this.randomItem(cities);
    const state = this.randomItem(states);
    const postalCode = this.randomInt(10000, 99999).toString();

    return {
      addressLine1: `${streetNumber} ${streetName} ${streetType}`,
      city,
      state: state.name,
      stateCode: state.code,
      postalCode
    };
  }

  generate(options: IdentityGeneratorOptions): TestIdentity {
    const firstName = this.randomItem(firstNames);
    const lastName = this.randomItem(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const email = this.generateEmail(firstName, lastName, options.runExecutionId);
    const username = this.generateUsername(firstName, lastName, options.runExecutionId);
    const phone = this.generatePhoneNumber();
    const dateOfBirth = this.generateDateOfBirth();
    const address = this.generateAddress();

    return {
      id: 0, // Will be set by database
      runExecutionId: options.runExecutionId,
      personaId: options.personaId,
      siteId: options.siteId,
      siteEnvironmentId: options.siteEnvironmentId,
      identityType: options.identityType,
      firstName,
      lastName,
      fullName,
      email,
      username,
      phone,
      dateOfBirth,
      addressLine1: address.addressLine1,
      city: address.city,
      state: address.stateCode,
      postalCode: address.postalCode,
      country: 'US',
      customFields: options.customFields,
      isActive: true,
      createdDate: new Date(),
      updatedDate: new Date()
    };
  }
}
