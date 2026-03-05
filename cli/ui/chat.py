class ChatInterface:
    def __init__(self, provider):
        self.provider = provider
        self.history = []

    def start(self):
        print(f"\n[!] Session started using {self.provider.get_model_name()}")
        print("[!] Type '/quit' to exit.")
        
        while True:
            user_input = input("\nYou: ")
            if user_input.lower() == '/quit':
                break
            
            self.history.append({"role": "user", "content": user_input})
            response = self.provider.generate_response(self.history)
            
            print(f"\nAgent: {response}")
            self.history.append({"role": "assistant", "content": response})
