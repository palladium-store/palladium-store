const bcrypt = { hash: async (pw: string) => `$2a$12$stubstubstubstubstubstuOqJp5VQ0ANA8n3FfCjJmY0WlVQe9K${pw.length}`, compare: async () => true };
export default bcrypt;
