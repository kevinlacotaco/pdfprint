use std::sync::LockResult;

pub trait LockResultExt {
    type Guard;

    /// Returns the lock guard or panics if it is [poisoned].
    ///
    /// [poisoned]: https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html#poisoning
    fn read_or_panic(self) -> Self::Guard;
}

impl<Guard> LockResultExt for LockResult<Guard> {
    type Guard = Guard;

    fn read_or_panic(self) -> Guard {
        #[allow(clippy::unwrap_used)]
        return self.unwrap();
    }
}
