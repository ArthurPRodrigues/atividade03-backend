class CreateUserUseCase {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(name, email, telefone) {
        const user = new this.userRepository.UserClass(name, email, telefone);
        return await this.userRepository.save(user);
    }
}

module.exports = CreateUserUseCase; 