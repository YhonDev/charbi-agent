from abc import ABC, abstractmethod

class BaseSkill(ABC):
    @abstractmethod
    def execute(self, *args, **kwargs):
        """Execute the skill logic."""
        pass

    @property
    @abstractmethod
    def name(self):
        """Return the skill name."""
        pass

    @property
    @abstractmethod
    def description(self):
        """Return a brief description of what the skill does."""
        pass
