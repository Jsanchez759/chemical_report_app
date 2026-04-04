from api.services.llm import llm_service


async def generate_one_chemical_report(prompt: str, chemical: str) -> str:
    """Generate chemical report using LLMService."""
    system_prompt = f"You are a chemistry expert. Generate a brief report about the chemical {chemical}"
    return await llm_service.call_llm(prompt=prompt, system_prompt=system_prompt)