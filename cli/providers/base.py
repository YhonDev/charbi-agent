from abc import ABC, abstractmethod

class BaseProvider(ABC):
    def __init__(self, config):
        self.config = config

    @abstractmethod
    def generate_response(self, messages):
        """Generates a response based on the conversation history."""
        pass

    @abstractmethod
    def get_model_name(self):
        """Returns the name of the model being used."""
        pass
