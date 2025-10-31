class user {
  constructor(name, email, telefone) {
    this.name = name;
    this.email = email;
    this.telefone = telefone;
  }

  getName() {
    return this.name;
  }

  getEmail() {
    return this.email;
  }

  getTelefone() {
    return this.telefone;
  }
}

module.exports = user;
