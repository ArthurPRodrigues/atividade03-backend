class CreateUserUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async userExists(email) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error("User with this email already exists.");
    }
  }

  async execute(name, email, telefone) {
    await this.userExists(email);
    const UserClass = this.userRepository.UserClass;
    const user = new UserClass(name, email, telefone);
    return await this.userRepository.save(user);
  }
}

module.exports = CreateUserUseCase;