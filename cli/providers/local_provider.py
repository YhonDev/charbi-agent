from .base import BaseProvider

class LocalProvider(BaseProvider):
    def generate_response(self, messages):
        # This is a mock localized response
        return f"[Local Model ({self.config.get('model')})]: Simulation of an AI response."

    def get_model_name(self):
        return self.config.get("model", "local-llama")
