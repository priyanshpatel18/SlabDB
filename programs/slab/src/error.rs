use anchor_lang::prelude::*;

#[error_code]
pub enum SlabError {
    /// SQLSTATE 42601 — statement is outside the v0 subset.
    #[msg("42601 syntax_error: statement is not in the v0 SQL subset")]
    SyntaxError,
    /// SQLSTATE 54000 — table / column / row cap.
    #[msg("54000 program_limit_exceeded")]
    ProgramLimitExceeded,
    #[msg("relation already exists")]
    RelationExists,
    #[msg("unknown column type")]
    UnknownType,
    #[msg("primary key attribute is out of range")]
    InvalidPrimaryKey,
    #[msg("identifier is empty or longer than the catalog field")]
    InvalidIdentifier,
    #[msg("unauthorized")]
    Unauthorized,
}
